import type { BrowserWindow } from 'electron'
import type { ScreenInfo, TestInfo } from '../shared/types'
import { coverScreen, createScreenWindow } from './screenWindow'

/** Open test windows, one per screen, by Electron display id. */
const windows = new Map<number, BrowserWindow>()

let onChange: () => void = () => {}

export function onTestWindowsChanged(callback: () => void): void {
  onChange = callback
}

export function openTestIds(): number[] {
  return [...windows.keys()]
}

export function openTestWindow(s: ScreenInfo, index: number, outputName: string | null): void {
  const info: TestInfo = { index, screen: s, outputName }
  const existing = windows.get(s.electronId)
  if (existing && !existing.isDestroyed()) {
    coverScreen(existing, s)
    existing.webContents.send('test:info', info)
    return
  }

  const win = createScreenWindow(s, 'test')
  windows.set(s.electronId, win)

  // Esc closes this test window. It is only a test, so it may close.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault()
      win.close()
    }
  })
  win.webContents.on('did-finish-load', () => win.webContents.send('test:info', info))
  win.on('closed', () => {
    windows.delete(s.electronId)
    onChange()
  })
  onChange()
}

export function closeTestWindows(): void {
  for (const win of windows.values()) if (!win.isDestroyed()) win.close()
}

/** Call after the screens change: close windows on removed screens, move the others. */
export function syncTestWindows(screens: ScreenInfo[]): void {
  for (const [id, win] of windows) {
    const s = screens.find((x) => x.electronId === id)
    if (!s) win.close()
    else coverScreen(win, s)
  }
}
