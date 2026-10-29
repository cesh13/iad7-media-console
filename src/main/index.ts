import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { randomUUID } from 'node:crypto'
import type { GroupConfig, ItemStatus, Overlays, PlaybackInfo, ScreensState, Settings, Target } from '../shared/types'
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
import { closePdfWindow } from './pdfPages'
import { outputRenders } from './render'
import * as svc from './service'
import { createService, loadService } from './serviceStore'
import { loadSettings, saveSettings } from './settings'
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
const orderExtensions = [...mediaExtensions, 'pdf', 'pptx', 'ppt', 'ppsx', 'pps', 'odp']
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

registerMediaScheme()

function screensState(): ScreensState {
  const screens = listScreens()
  return {
    screens,
    outputs: matchOutputs(settings.outputs, screens),
    testOpen: openTestIds(),
    groups: settings.groups,
    logo: settings.logo
  }
}

function sendScreensState(): void {
  controlWindow?.webContents.send('screens:changed', screensState())
}

function sendServiceState(): void {
  controlWindow?.webContents.send('service:changed', svc.serviceState())
}

function renderOutputs(): void {
  const ids = openOutputIds(matchOutputs(settings.outputs, listScreens()))
  for (const [id, render] of outputRenders(settings, ids)) sendRender(id, render)
}

/** Open, move or close output windows to match the saved outputs and the connected screens. */
function syncOutputs(): void {
  syncOutputWindows(matchOutputs(settings.outputs, listScreens()), () => renderOutputs())
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
  controlWindow.once('ready-to-show', () => controlWindow?.show())
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

  ipcMain.handle('test:close', () => {
    closeTestWindows()
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
  ipcMain.handle('service:get', () => svc.serviceState())
  ipcMain.handle('service:pickFiles', async () => {
    const paths = await pickPaths({ multi: true, extensions: orderExtensions, name: 'Video, images and slides' })
    return paths.length ? svc.addFiles(paths) : { added: 0, skipped: [] }
  })
  ipcMain.handle('service:addFiles', (_e, paths: string[]) => svc.addFiles(paths))
  ipcMain.handle('service:removeItem', (_e, id: string) => svc.removeItem(id))
  ipcMain.handle('service:retryCopy', (_e, id: string) => svc.retryCopy(id))
  ipcMain.handle('service:setDuration', (_e, id: string, seconds: number) => svc.setDuration(id, seconds))
  ipcMain.handle('service:moveItem', (_e, id: string, toIndex: number) => svc.moveItem(id, toIndex))
  ipcMain.handle('service:setItemStatus', (_e, id: string, status: ItemStatus) => svc.setItemStatus(id, status))
  ipcMain.handle('service:updateItem', (_e, id: string, change: Parameters<typeof svc.updateItem>[1]) =>
    svc.updateItem(id, change)
  )

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

  ipcMain.on('output:playback', (_e, info: PlaybackInfo & { ended: boolean }) => svc.reportPlayback(info))
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
    handleMediaScheme()
    settings = loadSettings()
    openCurrentService()
    groups.connectGroups(settings, setupChanged)
    registerIpc()
    onTestWindowsChanged(sendScreensState)
    watchScreens()
    onOutputWindowLost(syncOutputs)
    createControlWindow()
    syncOutputs()
  })

  app.on('before-quit', () => {
    allowOutputWindowsToClose()
    closePdfWindow()
    svc.flushSave()
  })

  app.on('window-all-closed', () => app.quit())
}
