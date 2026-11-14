import type { BrowserWindow } from 'electron'
import type { OutputRender, OutputStatus, ScreenInfo } from '../shared/types'
import { coverScreen, createScreenWindow } from './screenWindow'

/**
 * The real output windows, one per named screen that is connected.
 * They open when the app starts and stay open for the full session.
 * They close only when the app quits or their screen is removed.
 *
 * "Hide screens" hides them without closing them, so another program (Zoom,
 * a browser) can use those screens. Only the operator turns this on and off.
 */
interface Entry {
  win: BrowserWindow
  electronId: number
  /** The screen the window covers (to cover it again after "Hide screens"). */
  screen: ScreenInfo
  allowClose: boolean
}

const windows = new Map<string, Entry>()
let quitting = false
let hidden = false
let onLost: () => void = () => {}

/** "Hide screens" is on: the output windows are hidden and the screens show the Windows desktop. */
export function outputsHidden(): boolean {
  return hidden
}

/** Hide all output windows, or show them again. They keep running while hidden, so nothing is lost. */
export function setOutputsHidden(value: boolean): void {
  hidden = value
  for (const entry of windows.values()) {
    if (entry.win.isDestroyed()) continue
    if (hidden) {
      entry.win.hide()
    } else {
      coverScreen(entry.win, entry.screen)
      // Do not take the focus away from the control window.
      entry.win.showInactive()
    }
  }
}

/** Called when an output window closed without permission. It must open it again. */
export function onOutputWindowLost(callback: () => void): void {
  onLost = callback
}

export function allowOutputWindowsToClose(): void {
  quitting = true
}

/** Output ids that have an open window, in the order of `statuses`. */
export function openOutputIds(statuses: OutputStatus[]): string[] {
  return statuses.filter((s) => windows.has(s.output.id)).map((s) => s.output.id)
}

export function syncOutputWindows(statuses: OutputStatus[], onLoaded: (outputId: string) => void): void {
  const wanted = new Map(statuses.filter((s) => s.screen).map((s) => [s.output.id, s]))

  // Close windows whose output was removed or whose screen is not connected.
  for (const [outputId, entry] of windows) {
    const status = wanted.get(outputId)
    if (!status || status.screen!.electronId !== entry.electronId) {
      entry.allowClose = true
      entry.win.close()
      windows.delete(outputId)
    }
  }

  for (const [outputId, status] of wanted) {
    const screen = status.screen!
    const existing = windows.get(outputId)
    if (existing) {
      existing.screen = screen
      // A hidden window is put on its screen when the operator shows the screens again.
      if (!hidden) coverScreen(existing.win, screen)
      continue
    }
    const entry: Entry = {
      win: createScreenWindow(screen, 'live', () => hidden),
      electronId: screen.electronId,
      screen,
      allowClose: false
    }
    windows.set(outputId, entry)
    // Never close an output window during the session (no desktop on screen).
    entry.win.on('close', (event) => {
      if (!quitting && !entry.allowClose) event.preventDefault()
    })
    entry.win.webContents.on('before-input-event', (event, input) => {
      // Alt+F4 must not close it either.
      if (input.alt && input.key === 'F4') event.preventDefault()
    })
    // Some closes do not send the 'close' event (for example window.close() in
    // the page). If the window is gone without permission, open it again.
    entry.win.on('closed', () => {
      if (windows.get(outputId) === entry) windows.delete(outputId)
      if (!quitting && !entry.allowClose) setImmediate(onLost)
    })
    entry.win.webContents.on('did-finish-load', () => onLoaded(outputId))
    // If the page crashes, load it again, so the screen does not stay empty.
    entry.win.webContents.on('render-process-gone', () => {
      if (!entry.win.isDestroyed()) entry.win.reload()
    })
  }
}

export function sendRender(outputId: string, render: OutputRender): void {
  const entry = windows.get(outputId)
  if (entry && !entry.win.isDestroyed()) entry.win.webContents.send('output:render', render)
}
