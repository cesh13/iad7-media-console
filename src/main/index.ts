import { app, BrowserWindow, dialog, ipcMain, Menu, screen, session } from 'electron'
import { randomUUID } from 'node:crypto'
import type {
  BibleRef,
  GroupConfig,
  ItemSettings,
  ItemStatus,
  OutputStatus,
  Overlays,
  PlaybackInfo,
  ScreensState,
  Service,
  ServiceState,
  Settings,
  Target,
  TextStyle,
  TextStyleKind
} from '../shared/types'
import * as audio from './audio'
import * as bible from './bible'
import { bibleCatalog, downloadBible } from './bibleCatalog'
import { listScreens, matchOutputs } from './displays'
import * as groups from './groups'
import {
  allowOutputWindowsToClose,
  onOutputWindowLost,
  openOutputIds,
  sendRender,
  syncOutputWindows
} from './outputWindows'
import { loadPage, preloadPath } from './pages'
import { handleMediaScheme, registerMediaScheme } from './protocol'
import { onFolderIndexChanged, searchFolder } from './folderIndex'
import { closePdfWindow } from './pdfPages'
import * as shared from './sharedFolder'
import * as stage from './stage'
import * as library from './library'
import { listServices } from './serviceStore'
import { outputRenders } from './render'
import * as svc from './service'
import { createService, loadService } from './serviceStore'
import { loadSettings, saveSettings } from './settings'
import * as textStyles from './textStyles'
import {
  closeTestWindows,
  onTestWindowsChanged,
  openTestIds,
  openTestWindow,
  syncTestWindows
} from './testWindows'

// The main process holds the state. Windows only show what we send them.
let settings: Settings
let controlWindow: BrowserWindow | null = null

const mediaExtensions = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const orderExtensions = [...mediaExtensions, 'pdf', 'pptx', 'ppt', 'ppsx', 'pps', 'odp', 'txt']
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

registerMediaScheme()

/** Electron id of the screen that shows most of the control window. */
function consoleScreenId(): number | null {
  if (!controlWindow || controlWindow.isDestroyed()) return null
  return screen.getDisplayMatching(controlWindow.getBounds()).id
}

/**
 * The saved outputs that get a window now. An output on the console screen
 * gets no window: a fullscreen window that is always on top would cover the
 * control window, and then nobody can use the app.
 */
function openableOutputs(): OutputStatus[] {
  const consoleId = consoleScreenId()
  return matchOutputs(settings.outputs, listScreens()).map((s) =>
    s.screen && s.screen.electronId === consoleId ? { ...s, screen: null } : s
  )
}

function screensState(): ScreensState {
  const screens = listScreens()
  return {
    screens,
    outputs: matchOutputs(settings.outputs, screens),
    testOpen: openTestIds(),
    groups: settings.groups,
    logo: settings.logo,
    consoleScreen: consoleScreenId()
  }
}

function sendScreensState(): void {
  controlWindow?.webContents.send('screens:changed', screensState())
}

/** The service state, with the stage parts (timer, messages, stage screens). */
function serviceStateFull(): ServiceState {
  const state = svc.serviceState()
  return {
    ...state,
    groups: state.groups.map((g) => (g.config.stageView ? { ...g, stage: stage.stageRender(g.config, settings.groups) } : g)),
    stageTimer: stage.stageTimer(),
    stageMessage: stage.stageMessage(),
    messages: stage.savedMessages(),
    services: listServices(),
    library: library.libraryFolders(),
    favorites: library.favorites(),
    textStyles: textStyles.textStyles()
  }
}

function sendServiceState(): void {
  controlWindow?.webContents.send('service:changed', serviceStateFull())
}

function renderOutputs(): void {
  const ids = openOutputIds(openableOutputs())
  for (const [id, render] of outputRenders(settings, ids)) sendRender(id, render)
}

/** Open, move or close output windows to match the saved outputs and the connected screens. */
function syncOutputs(): void {
  syncOutputWindows(openableOutputs(), () => renderOutputs())
  renderOutputs()
}

/** After outputs, groups, idle files or the logo change. */
function setupChanged(): void {
  syncOutputs()
  svc.groupsChanged()
  sendScreensState()
}

function createControlWindow(): void {
  controlWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#101215',
    title: 'Media Console',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: preloadPath(), sandbox: true }
  })
  // The control monitor is only for this app: use all of it.
  controlWindow.once('ready-to-show', () => {
    controlWindow?.maximize()
    controlWindow?.show()
  })
  // If the control window moves to another screen, the output there closes
  // and the output on the old console screen opens.
  let lastScreen: number | null = null
  const moved = (): void => {
    const id = consoleScreenId()
    if (id === lastScreen) return
    lastScreen = id
    syncOutputs()
    sendScreensState()
  }
  controlWindow.on('moved', moved)
  controlWindow.on('maximize', moved)
  controlWindow.on('show', moved)
  // Closing the control window ends the app, and with it all screen windows.
  controlWindow.on('closed', () => {
    controlWindow = null
    app.quit()
  })
  loadPage(controlWindow, 'index')
}

async function pickPaths(options: { multi: boolean; extensions: string[]; name: string }): Promise<string[]> {
  if (!controlWindow) return []
  const result = await dialog.showOpenDialog(controlWindow, {
    properties: options.multi ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [
      { name: options.name, extensions: options.extensions },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  return result.canceled ? [] : result.filePaths
}

function registerIpc(): void {
  // ---- Screens ----
  ipcMain.handle('screens:get', () => screensState())

  ipcMain.handle('outputs:save', (_e, displayKey: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return screensState()
    // If a saved output already matches this screen, rename it and update its key.
    const match = matchOutputs(settings.outputs, listScreens()).find(
      (o) => o.screen?.displayKey === displayKey
    )
    if (match) {
      match.output.name = trimmed
      match.output.displayKey = displayKey
    } else {
      const output = { id: randomUUID(), displayKey, name: trimmed }
      settings.outputs.push(output)
      groups.placeNewOutput(output.id)
    }
    saveSettings(settings)
    setupChanged()
    return screensState()
  })

  ipcMain.handle('outputs:remove', (_e, outputId: string) => {
    settings.outputs = settings.outputs.filter((o) => o.id !== outputId)
    groups.forgetOutput(outputId)
    saveSettings(settings)
    setupChanged()
    return screensState()
  })

  ipcMain.handle('test:open', (_e, electronIds: number[]) => {
    const state = screensState()
    state.screens.forEach((s, i) => {
      if (!electronIds.includes(s.electronId)) return
      const output = state.outputs.find((o) => o.screen?.electronId === s.electronId)
      openTestWindow(s, i + 1, output?.output.name ?? null)
    })
    return screensState()
  })

  ipcMain.handle('test:close', (_e, electronIds?: number[]) => {
    closeTestWindows(electronIds)
    return screensState()
  })

  // ---- Groups ----
  ipcMain.handle('groups:add', (_e, name: string) => groups.addGroup(name))
  ipcMain.handle('groups:remove', (_e, id: string) => groups.removeGroup(id))
  ipcMain.handle('groups:update', (_e, id: string, change: Partial<GroupConfig>) => groups.updateGroup(id, change))
  ipcMain.handle('groups:assign', (_e, outputId: string, groupId: string | null) =>
    groups.assignOutput(outputId, groupId)
  )
  ipcMain.handle('groups:pickIdle', async (_e, id: string) => {
    const paths = await pickPaths({ multi: true, extensions: mediaExtensions, name: 'Video and images' })
    if (paths.length) groups.setIdleMedia(id, paths)
  })
  ipcMain.handle('groups:clearIdle', (_e, id: string) => groups.setIdleMedia(id, []))
  ipcMain.handle('groups:pickLogo', async () => {
    const [path] = await pickPaths({ multi: false, extensions: imageExtensions, name: 'Images' })
    if (path) groups.setLogo(path)
  })

  // ---- Service order ----
  ipcMain.handle('service:get', () => serviceStateFull())
  ipcMain.handle('service:addCountdown', () => svc.addCountdown())

  // ---- Services ----
  ipcMain.handle('services:new', () => {
    const s = createService()
    // Two new services on the same day get different names.
    const same = listServices().filter((x) => x.name.startsWith(s.name)).length
    if (same) s.name = `${s.name} (${same + 1})`
    openService(s)
  })
  ipcMain.handle('services:open', (_e, id: string) => {
    const s = loadService(id)
    if (s && id !== svc.currentServiceId()) openService(s)
  })
  ipcMain.handle('services:rename', (_e, name: string) => svc.renameService(name))
  ipcMain.handle('services:items', (_e, id: string) => loadService(id)?.items ?? [])
  ipcMain.handle('services:copy', (_e, id: string) => {
    const s = loadService(id)
    if (s) svc.copyOrder(s)
  })

  // ---- Library, favorites, hotkeys ----
  ipcMain.handle('library:pick', async () => {
    if (!controlWindow) return
    const result = await dialog.showOpenDialog(controlWindow, { properties: ['openDirectory'] })
    if (!result.canceled && result.filePaths[0]) library.addLibraryFolder(result.filePaths[0])
  })
  ipcMain.handle('library:remove', (_e, path: string) => library.removeLibraryFolder(path))
  ipcMain.handle('library:list', (_e, path: string) => library.listLibrary(path))
  ipcMain.handle('library:search', (_e, path: string, query: string) => library.searchLibrary(path, query))
  ipcMain.handle('favorites:add', (_e, path: string) => {
    library.addFavorite(path)
    prepareHotkeyFiles()
  })
  ipcMain.handle('favorites:addAction', (_e, kind: 'logo' | 'black' | 'countdown') => library.addFavoriteAction(kind))
  ipcMain.handle('favorites:remove', (_e, id: string) => library.removeFavorite(id))
  ipcMain.handle('favorites:hotkey', (_e, id: string, key: number | null) => {
    library.setHotkey(id, key)
    prepareHotkeyFiles()
  })
  ipcMain.handle('hotkey:trigger', (_e, key: number) => triggerHotkey(key))

  // ---- Stage and messages ----
  ipcMain.handle('stage:timerSet', (_e, label: string, seconds: number) => stage.timerSet(label, seconds))
  ipcMain.handle('stage:timerStart', () => stage.timerStart())
  ipcMain.handle('stage:timerPause', () => stage.timerPause())
  ipcMain.handle('stage:timerReset', () => stage.timerReset())
  ipcMain.handle('stage:message', (_e, text: string | null) => stage.setStageMessage(text))
  ipcMain.handle('message:show', (_e, line1: string, line2: string, target: Target) => svc.showMessage(line1, line2, target))
  ipcMain.handle('message:save', (_e, line1: string, line2: string) => stage.saveMessage(line1, line2))
  ipcMain.handle('message:delete', (_e, id: string) => stage.deleteMessage(id))
  ipcMain.handle('service:pickFiles', async () => {
    const paths = await pickPaths({ multi: true, extensions: orderExtensions, name: 'Video, images and slides' })
    return paths.length ? svc.addFiles(paths) : { added: 0, skipped: [] }
  })
  ipcMain.handle('service:addFiles', (_e, paths: string[]) => svc.addFiles(paths))
  ipcMain.handle('service:pickFolder', async () => {
    if (!controlWindow) return
    const result = await dialog.showOpenDialog(controlWindow, { properties: ['openDirectory'] })
    if (!result.canceled && result.filePaths[0]) svc.addFolder(result.filePaths[0])
  })
  ipcMain.handle('service:searchFolder', (_e, id: string, query: string) => {
    const item = svc.findItem(id)
    return item?.type === 'folder' ? searchFolder(item.path, query) : []
  })
  ipcMain.handle('service:chooseInFolder', (_e, id: string, path: string) => svc.chooseInFolder(id, path))
  ipcMain.handle('service:removeItem', (_e, id: string) => svc.removeItem(id))
  ipcMain.handle('service:retryCopy', (_e, id: string) => svc.retryCopy(id))
  ipcMain.handle('service:setDuration', (_e, id: string, seconds: number) => svc.setDuration(id, seconds))
  ipcMain.handle('service:moveItem', (_e, id: string, toIndex: number) => svc.moveItem(id, toIndex))
  ipcMain.handle('service:setItemStatus', (_e, id: string, status: ItemStatus) => svc.setItemStatus(id, status))
  ipcMain.handle('service:updateItem', (_e, id: string, change: Parameters<typeof svc.updateItem>[1]) =>
    svc.updateItem(id, change)
  )
  ipcMain.handle('service:newTextItem', () => svc.newTextItem())
  ipcMain.handle('service:undo', () => svc.undo())
  ipcMain.handle('service:pickItemBackground', async (_e, id: string) => {
    const [path] = await pickPaths({ multi: false, extensions: mediaExtensions, name: 'Video and images' })
    const ref = path ? groups.mediaRef(path) : null
    if (ref && ref.type !== 'audio') svc.updateItem(id, { settings: { background: ref } })
  })

  // ---- Text styles ----
  ipcMain.handle('textStyles:set', (_e, kind: TextStyleKind, change: Partial<TextStyle>) => {
    const { backgroundMedia: _ignored, ...rest } = change
    textStyles.setTextStyle(kind, rest)
  })
  ipcMain.handle('textStyles:pickBackground', async (_e, kind: TextStyleKind) => {
    const [path] = await pickPaths({ multi: false, extensions: mediaExtensions, name: 'Video and images' })
    if (path) textStyles.setTextBackground(kind, path)
  })
  ipcMain.handle('textStyles:reset', (_e, kind: TextStyleKind) => textStyles.resetTextStyle(kind))

  // ---- Shared folder ----
  ipcMain.handle('shared:get', () => shared.sharedState())
  ipcMain.handle('shared:pick', async () => {
    if (!controlWindow) return
    const result = await dialog.showOpenDialog(controlWindow, { properties: ['openDirectory'] })
    if (!result.canceled && result.filePaths[0]) setShared(result.filePaths[0])
  })
  ipcMain.handle('shared:set', (_e, path: string | null) => setShared(path))
  ipcMain.handle('shared:add', async (_e, paths: string[]) => {
    // A folder of the share adds its files one by one ("All"), in file-name order.
    const files = paths.flatMap((p) => {
      const entry = shared.sharedState().entries.find((e) => e.path === p)
      return entry?.dir ? shared.sharedFilesIn(entry.rel) : [p]
    })
    await svc.addFiles(files, true)
    shared.markSeen(files)
  })
  ipcMain.handle('shared:seen', (_e, paths?: string[]) => shared.markSeen(paths))

  // ---- Audio ----
  ipcMain.handle('audio:get', () => audio.audioState())
  ipcMain.handle('audio:update', (_e, change: Parameters<typeof audio.updateAudio>[0]) => {
    audio.updateAudio(change)
    renderOutputs() // Video volume and device.
  })
  ipcMain.handle('audio:pickMusic', async (_e, folder: boolean) => {
    if (!controlWindow) return
    const result = await dialog.showOpenDialog(controlWindow, {
      properties: folder ? ['openDirectory'] : ['openFile', 'multiSelections'],
      filters: folder ? undefined : [{ name: 'Music', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac'] }]
    })
    if (!result.canceled) await audio.addMusic(result.filePaths)
  })
  ipcMain.handle('audio:addMusic', (_e, paths: string[]) => audio.addMusic(paths))
  ipcMain.handle('audio:clearPlaylist', () => audio.clearPlaylist())
  ipcMain.handle('audio:play', (_e, index?: number) => audio.play(index))
  ipcMain.handle('audio:pause', () => audio.pause())
  ipcMain.handle('audio:next', () => audio.next())
  ipcMain.handle('audio:previous', () => audio.previous())
  ipcMain.handle('audio:fadeOut', () => audio.fadeOut())
  ipcMain.handle('audio:stopItem', () => svc.clearAudio())
  ipcMain.on('audio:report', (_e, r: Parameters<typeof audio.report>[0]) => audio.report(r))
  ipcMain.on('audio:levels', (e, source: string, l: number, r: number) => audio.setLevels(`${source}:${e.sender.id}`, l, r))

  // ---- Live ----
  ipcMain.handle('live:target', (_e, target: Target) => svc.setTarget(target))
  ipcMain.handle('live:go', (_e, id: string, target?: Target, page?: number) => svc.goLive(id, target, page))
  ipcMain.handle('live:pageStep', (_e, delta: number) => svc.pageStep(delta))
  ipcMain.handle('live:showPage', (_e, id: string, page: number) => svc.showPage(id, page))
  ipcMain.handle('live:next', () => svc.next())
  ipcMain.handle('live:previous', () => svc.previous())
  ipcMain.handle('live:clear', (_e, groupId?: string) => svc.clear(groupId))
  ipcMain.handle('live:setPlaying', (_e, take: number, playing: boolean) => svc.setPlaying(take, playing))
  ipcMain.handle('live:seek', (_e, take: number, seconds: number) => svc.seek(take, seconds))
  ipcMain.handle('live:overlay', (_e, name: keyof Overlays, on: boolean) => svc.setOverlay(name, on))
  ipcMain.handle('live:clearText', (_e, groupId?: string) => svc.clearText(groupId))

  // ---- Bible ----
  const importBibleFile = async (path: string): Promise<string | null> => {
    try {
      await bible.importBible(path)
      sendServiceState()
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }
  ipcMain.handle('bible:import', async () => {
    const [path] = await pickPaths({ multi: false, extensions: ['xml', 'json', 'txt', 'csv', 'tsv'], name: 'Bible files' })
    return path ? importBibleFile(path) : null
  })
  ipcMain.handle('bible:importFrom', (_e, path: string) => importBibleFile(path))
  ipcMain.handle('bible:catalog', (_e, refresh?: boolean) => bibleCatalog(refresh))
  ipcMain.handle('bible:download', async (_e, id: string) => {
    try {
      await downloadBible(id, (fraction) => controlWindow?.webContents.send('bible:downloadProgress', { id, fraction }))
      sendServiceState()
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  })
  ipcMain.handle('bible:remove', (_e, id: string) => {
    bible.removeBible(id)
    sendServiceState()
  })
  ipcMain.handle('bible:chapter', (_e, id: string, book: number, chapter: number) => bible.getChapter(id, book, chapter))
  ipcMain.handle('bible:search', (_e, id: string, query: string) => bible.search(id, query))
  ipcMain.handle('bible:addToOrder', (_e, ref: BibleRef) => svc.addBibleToOrder(ref))
  ipcMain.handle('bible:showNow', (_e, ref: BibleRef, startVerse?: number) => svc.showBibleNow(ref, startVerse))
  ipcMain.handle('bible:showVerse', (_e, verse: number) => svc.showVerse(verse))
  ipcMain.handle('bible:screens', (_e, ref: BibleRef, settings: Partial<ItemSettings>) => svc.bibleScreens(ref, settings))

  ipcMain.on('output:playback', (_e, info: PlaybackInfo & { ended: boolean }) => svc.reportPlayback(info))
}

/**
 * Let the app windows list the audio output devices with their names and
 * choose one (setSinkId). Only the app's own pages ask for this.
 */
function allowAudioDevices(): void {
  const ownPage = (url: string) => url.startsWith('file://') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => {
    if (permission === 'media' || permission === 'speaker-selection') return ownPage(origin)
    return true
  })
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(permission === 'speaker-selection' ? ownPage(details.requestingUrl) : permission !== 'media')
  })
}

function setShared(path: string | null): void {
  settings.sharedFolder = path?.trim() || undefined
  saveSettings(settings)
  shared.setSharedFolder(settings.sharedFolder ?? null)
}

function watchScreens(): void {
  const changed = (): void => {
    syncTestWindows(listScreens())
    syncOutputs()
    sendScreensState()
  }
  screen.on('display-added', changed)
  screen.on('display-removed', changed)
  screen.on('display-metrics-changed', changed)
}

function openService(s: Service): void {
  settings.currentServiceId = s.id
  saveSettings(settings)
  svc.switchService(s)
}

/** Hotkey files are copied and converted before they are needed. */
function prepareHotkeyFiles(): void {
  for (const f of library.favorites()) if (f.kind === 'file' && f.path && f.hotkey) svc.prepareExtra(f.path)
}

/** One press = live now (SPEC 5.6). Logo and black are switched on and off. */
function triggerHotkey(key: number): void {
  const f = library.favoriteForKey(key)
  if (!f) return
  const overlays = svc.getOverlays()
  if (f.kind === 'logo') svc.setOverlay('logo', !overlays.logo)
  else if (f.kind === 'black') svc.setOverlay('black', !overlays.black)
  else if (f.kind === 'countdown') svc.goLiveCountdown(f.seconds ?? 300, f.title)
  else if (f.path) svc.goLiveFile(f.path)
}

function openCurrentService(): void {
  let service = settings.currentServiceId ? loadService(settings.currentServiceId) : null
  if (!service) {
    service = createService()
    settings.currentServiceId = service.id
    saveSettings(settings)
  }
  svc.connectService({
    groups: () => settings.groups,
    logoUrl: () => settings.logo?.url,
    onChange: (outputsChanged) => {
      sendServiceState()
      if (outputsChanged) renderOutputs()
      audio.videoStateChanged()
    }
  })
  svc.initService(service)
}

// Only one copy of the app may run, so two apps never fight over the screens.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (controlWindow?.isMinimized()) controlWindow.restore()
    controlWindow?.focus()
  })

  app.whenReady().then(() => {
    // No menu: its shortcuts (for example Ctrl+R = reload) must not act during a service.
    // macOS keeps its menu, which has copy and paste.
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    handleMediaScheme()
    allowAudioDevices()
    settings = loadSettings()
    // Connect all modules first: opening the service starts copies, and their
    // progress already updates the screens (which read audio and stage state).
    groups.connectGroups(settings, setupChanged)
    textStyles.connectTextStyles(settings, () => svc.refreshTextStyles())
    audio.connectAudio(settings, {
      videoPlaying: svc.videoPlaying,
      onChange: () => controlWindow?.webContents.send('audio:changed', audio.audioState()),
      onItemEnded: svc.audioItemEnded
    })
    stage.connectStage(settings, () => {
      sendServiceState()
      renderOutputs()
    })
    library.connectLibrary(settings, sendServiceState)
    svc.connectUsage(library.markUsed)
    svc.connectAudioHooks({
      playItem: audio.playItem,
      stopItem: audio.stopItem,
      stopMusic: audio.fadeOut,
      orderEnded: audio.orderEnded
    })
    openCurrentService()
    prepareHotkeyFiles()
    registerIpc()
    onTestWindowsChanged(sendScreensState)
    watchScreens()
    onOutputWindowLost(syncOutputs)
    onFolderIndexChanged(() => sendServiceState())
    shared.onSharedChanged(() => controlWindow?.webContents.send('shared:changed', shared.sharedState()))
    if (settings.sharedFolder) shared.setSharedFolder(settings.sharedFolder)
    createControlWindow()
    syncOutputs()
  })

  app.on('before-quit', () => {
    allowOutputWindowsToClose()
    closePdfWindow()
    audio.closeAudioWindow()
    shared.stopShared()
    svc.flushSave()
  })

  app.on('window-all-closed', () => app.quit())
}
