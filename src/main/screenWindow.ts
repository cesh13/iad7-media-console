import { BrowserWindow } from 'electron'
import type { ScreenInfo } from '../shared/types'
import { loadPage, preloadPath } from './pages'

/**
 * Put a window on a screen and make it cover the full screen.
 * Rules for all screen windows: frameless, fullscreen, always on top,
 * pointer hidden (the page sets cursor: none).
 */
export function coverScreen(win: BrowserWindow, s: ScreenInfo): void {
  win.setFullScreen(false)
  win.setBounds({ x: s.x, y: s.y, width: s.width, height: s.height })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setFullScreen(true)
}

/**
 * Create a window for one screen. Do not set `resizable: false`: on Windows
 * that makes a frameless window 14×7 px bigger than the screen.
 */
export function createScreenWindow(s: ScreenInfo, mode: 'test' | 'live'): BrowserWindow {
  const win = new BrowserWindow({
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    frame: false,
    show: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: preloadPath(),
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.once('ready-to-show', () => {
    coverScreen(win, s)
    // A test window takes focus so Esc can close it. A live window must not
    // take focus away from the control window.
    if (mode === 'test') win.show()
    else win.showInactive()
  })
  loadPage(win, 'output', { mode })
  return win
}
