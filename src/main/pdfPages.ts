import { BrowserWindow, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { PdfJob } from '../shared/types'
import { cacheDir, mediaUrl } from './cache'
import { loadPage, preloadPath } from './pages'

/**
 * Turn PDF pages into PNG pictures in the media cache, with the text of each
 * page. A hidden window does the work with pdf.js, one PDF at a time.
 * Slides then show as pictures: fast to change, same in every window.
 */

export interface PdfPages {
  dir: string
  pageUrls: string[]
  texts: string[]
}

/** Pictures are made for screens up to this size. */
const pageWidth = 1920
const pageHeight = 1080

interface Job extends Omit<PdfJob, 'data'> {
  pdfPath: string
  dir: string
  texts: string[]
  onProgress: (fraction: number) => void
  resolve: (pages: PdfPages) => void
  reject: (err: Error) => void
}

let win: BrowserWindow | null = null
let ready: Promise<void> | null = null
let markReady: () => void = () => {}
const queue: Job[] = []
let current: Job | null = null
let nextId = 1

function pagePath(dir: string, index: number): string {
  return join(dir, `p${String(index + 1).padStart(4, '0')}.png`)
}

function infoPath(dir: string): string {
  return join(dir, 'pages.json')
}

function result(dir: string, count: number, texts: string[]): PdfPages {
  return { dir, texts, pageUrls: Array.from({ length: count }, (_, i) => mediaUrl(pagePath(dir, i))) }
}

function ensureWindow(): Promise<void> {
  if (win && !win.isDestroyed() && ready) return ready
  ready = new Promise((resolve) => (markReady = resolve))
  win = new BrowserWindow({ show: false, webPreferences: { preload: preloadPath(), sandbox: true, backgroundThrottling: false } })
  win.on('closed', () => {
    win = null
    ready = null
    // If the window dies during a job, fail the job so the item shows an error.
    current?.reject(new Error('The PDF window closed'))
    current = null
    runNext()
  })
  loadPage(win, 'pdf')
  return ready
}

function runNext(): void {
  if (current || queue.length === 0) return
  current = queue.shift()!
  const job = current
  // The window gets the bytes of the file, so it does not need to load anything.
  void Promise.all([ensureWindow(), readFile(job.pdfPath)])
    .then(([, data]) => {
      win?.webContents.send('pdf:job', { id: job.id, data: new Uint8Array(data), width: job.width, height: job.height } satisfies PdfJob)
    })
    .catch((err: Error) => {
      current = null
      job.reject(err)
      runNext()
    })
}

ipcMain.on('pdf:ready', () => markReady())

ipcMain.on('pdf:page', (_e, id: number, index: number, count: number, png: Uint8Array, text: string) => {
  const job = current
  if (!job || job.id !== id) return
  writeFileSync(pagePath(job.dir, index), png)
  job.texts[index] = text
  job.onProgress((index + 1) / count)
})

ipcMain.on('pdf:done', (_e, id: number, error: string | null) => {
  const job = current
  if (!job || job.id !== id) return
  current = null
  if (error) {
    job.reject(new Error(error))
  } else {
    writeFileSync(infoPath(job.dir), JSON.stringify({ count: job.texts.length, texts: job.texts }), 'utf8')
    job.resolve(result(job.dir, job.texts.length, job.texts))
  }
  runNext()
})

/** Make the page pictures of a cached PDF, or reuse them if they exist. */
export function renderPdfPages(pdfPath: string, onProgress: (fraction: number) => void): Promise<PdfPages> {
  const dir = join(cacheDir(), `${basename(pdfPath, extname(pdfPath))}-pages`)
  if (existsSync(infoPath(dir))) {
    try {
      const info = JSON.parse(readFileSync(infoPath(dir), 'utf8')) as { count: number; texts: string[] }
      onProgress(1)
      return Promise.resolve(result(dir, info.count, info.texts))
    } catch {
      // Damaged info file: make the pictures again.
    }
  }
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return new Promise((resolve, reject) => {
    queue.push({
      id: nextId++,
      width: pageWidth,
      height: pageHeight,
      pdfPath,
      dir,
      texts: [],
      onProgress,
      resolve,
      reject
    })
    runNext()
  })
}

export function closePdfWindow(): void {
  if (win && !win.isDestroyed()) win.destroy()
}
