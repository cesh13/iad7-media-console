import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { randomUUID } from 'node:crypto'
import type { ItemStatus, OutputRender, PlaybackInfo, ScreensState, Settings } from '../shared/types'
import { listScreens, matchOutputs } from './displays'
import {
  allowOutputWindowsToClose,
  onOutputWindowLost,
  openOutputIds,
  sendRender,
  syncOutputWindows
} from './outputWindows'
import { loadPage, preloadPath } from './pages'
import { handleMediaScheme, registerMediaScheme } from './protocol'
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

registerMediaScheme()

function screensState(): ScreensState {
  const screens = listScreens()
  return { screens, outputs: matchOutputs(settings.outputs, screens), testOpen: openTestIds() }
}

function sendScreensState(): void {
  controlWindow?.webContents.send('screens:changed', screensState())
}

function sendServiceState(): void {
  controlWindow?.webContents.send('service:changed', svc.serviceState())
}

/** What one output shows now. */
function outputRender(outputId: string, audioOutputId: string | undefined): OutputRender {
  const output = settings.outputs.find((o) => o.id === outputId)
  const group = svc.getGroup()
  const item = group.live ? svc.findItem(group.live.itemId) : undefined
  return {
    outputName: output?.name ?? '',
    audio: outputId === audioOutputId,
    live:
      group.live && item?.url
        ? {
            take: group.live.take,
            type: item.type,
            url: item.url,
            playing: group.live.playing,
            seekTo: group.live.seekTo,
            seekId: group.live.seekId
          }
        : null
  }
}

function renderOutputs(): void {
  const ids = openOutputIds(matchOutputs(settings.outputs, listScreens()))
  for (const id of ids) sendRender(id, outputRender(id, ids[0]))
}

/** Open, move or close output windows to match the saved outputs and the connected screens. */
function syncOutputs(): void {
  svc.setGroupOutputs(settings.outputs.map((o) => o.id))
  syncOutputWindows(matchOutputs(settings.outputs, listScreens()), () => renderOutputs())
  renderOutputs()
}

function createControlWindow(): void {
  controlWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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
      settings.outputs.push({ id: randomUUID(), displayKey, name: trimmed })
    }
    saveSettings(settings)
    syncOutputs()
    sendScreensState()
    return screensState()
  })

  ipcMain.handle('outputs:remove', (_e, outputId: string) => {
    settings.outputs = settings.outputs.filter((o) => o.id !== outputId)
    saveSettings(settings)
    syncOutputs()
    sendScreensState()
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

  // ---- Service order ----
  ipcMain.handle('service:get', () => svc.serviceState())

  ipcMain.handle('service:pickFiles', async () => {
    if (!controlWindow) return { added: 0, skipped: [] }
    const result = await dialog.showOpenDialog(controlWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video and images', extensions: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return result.canceled ? { added: 0, skipped: [] } : svc.addFiles(result.filePaths)
  })
  ipcMain.handle('service:addFiles', (_e, paths: string[]) => svc.addFiles(paths))
  ipcMain.handle('service:removeItem', (_e, id: string) => svc.removeItem(id))
  ipcMain.handle('service:retryCopy', (_e, id: string) => svc.retryCopy(id))
  ipcMain.handle('service:setDuration', (_e, id: string, seconds: number) => svc.setDuration(id, seconds))
  ipcMain.handle('service:moveItem', (_e, id: string, toIndex: number) => svc.moveItem(id, toIndex))
  ipcMain.handle('service:setItemStatus', (_e, id: string, status: ItemStatus) => svc.setItemStatus(id, status))
  ipcMain.handle('live:go', (_e, id: string) => svc.goLive(id))
  ipcMain.handle('live:next', () => svc.next())
  ipcMain.handle('live:previous', () => svc.previous())
  ipcMain.handle('live:clear', () => svc.clearLive(true))
  ipcMain.handle('live:setPlaying', (_e, playing: boolean) => svc.setPlaying(playing))
  ipcMain.handle('live:seek', (_e, seconds: number) => svc.seek(seconds))

  ipcMain.on('output:playback', (_e, info: Omit<PlaybackInfo, 'itemId'> & { ended: boolean }) =>
    svc.reportPlayback(info)
  )
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
  svc.initService(service)
  svc.onServiceChanged((outputsChanged) => {
    sendServiceState()
    if (outputsChanged) renderOutputs()
  })
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
    registerIpc()
    onTestWindowsChanged(sendScreensState)
    watchScreens()
    onOutputWindowLost(syncOutputs)
    createControlWindow()
    syncOutputs()
  })

  app.on('before-quit', () => {
    allowOutputWindowsToClose()
    svc.flushSave()
  })

  app.on('window-all-closed', () => app.quit())
}
