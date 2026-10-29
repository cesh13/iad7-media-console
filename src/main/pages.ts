import type { BrowserWindow } from 'electron'
import { join } from 'node:path'

export function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

/** Load a renderer page: from the Vite dev server in dev, from files in a build. */
export function loadPage(win: BrowserWindow, page: 'index' | 'output', query: Record<string, string> = {}): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    const search = new URLSearchParams(query).toString()
    void win.loadURL(`${devUrl}/${page}.html${search ? `?${search}` : ''}`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}.html`), { query })
  }
}
