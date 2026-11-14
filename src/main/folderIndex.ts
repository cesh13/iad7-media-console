import { app } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, relative, sep } from 'node:path'
import { normalize } from '../shared/bibleBooks'
import type { FolderEntry } from '../shared/types'
import { fileText } from './fileText'
import { byFileName, isSkippedDir, itemType } from './fileTypes'

/**
 * Search index of a folder item (for example the hymnal with 613 files):
 * number, title and the words in the file (lyrics). Built once when the
 * folder is added, saved to disk, and updated when the folder changes.
 * It includes subfolders. Files are keyed by their path inside the folder,
 * with "/" (for example "Navidad/045 Noche de paz.pptx"), because two
 * subfolders can have a file with the same name.
 */

/** How many levels of subfolders are read. The Resource folder uses the same limit. */
const maxDepth = 3
/** Stop here, so a very big folder (Documents chosen by mistake) does not fill the index. */
const maxFiles = 5000

interface Indexed {
  size: number
  mtime: number
  text: string
}

interface FolderIndex {
  folder: string
  entries: Map<string, FolderEntry & { norm: string; normTitle: string }>
  cache: Record<string, Indexed>
  /** 0..1 while the first index is built, null when ready. */
  progress: number | null
  watcher: FSWatcher | null
  saveTimer: NodeJS.Timeout | null
}

const indexes = new Map<string, FolderIndex>()
let notify: (folder: string) => void = () => {}

export function onFolderIndexChanged(callback: (folder: string) => void): void {
  notify = callback
}

function indexFile(folder: string): string {
  const dir = join(app.getPath('userData'), 'indexes')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, `${createHash('sha1').update(folder.toLowerCase()).digest('hex').slice(0, 16)}.json`)
}

/** "045 Santo, santo, santo.pptx" → number 45, title "Santo, santo, santo". */
function parseName(path: string): { number: number | null; title: string } {
  const name = basename(path, extname(path))
  const m = /^\s*(\d+)\s*[-._)\s]*\s*(.*)$/.exec(name)
  if (!m) return { number: null, title: name.trim() }
  return { number: Number(m[1]), title: (m[2] || name).trim() }
}

/** "Navidad/045 Noche de paz.pptx" → "Navidad". A file at the top → "". */
function dirOf(rel: string): string {
  const i = rel.lastIndexOf('/')
  return i < 0 ? '' : rel.slice(0, i)
}

function makeEntry(path: string, rel: string, text: string): FolderEntry & { norm: string; normTitle: string } {
  const { number, title } = parseName(path)
  const normTitle = normalize(title)
  return {
    path,
    name: basename(path),
    dir: dirOf(rel),
    number,
    title,
    type: itemType(path)!,
    snippet: text.split('\n').find((l) => l.trim())?.trim().slice(0, 80) ?? '',
    normTitle,
    norm: `${normTitle} ${normalize(text)}`
  }
}

function scheduleSave(ix: FolderIndex): void {
  if (ix.saveTimer) clearTimeout(ix.saveTimer)
  ix.saveTimer = setTimeout(() => {
    writeFileSync(indexFile(ix.folder), JSON.stringify({ folder: ix.folder, files: ix.cache }), 'utf8')
  }, 1000)
}

async function indexOne(ix: FolderIndex, rel: string): Promise<void> {
  const path = join(ix.folder, rel)
  if (!itemType(path)) return
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) return
  let cached = ix.cache[rel]
  if (!cached || cached.size !== info.size || cached.mtime !== info.mtimeMs) {
    cached = { size: info.size, mtime: info.mtimeMs, text: await fileText(path) }
    ix.cache[rel] = cached
  }
  ix.entries.set(rel, makeEntry(path, rel, cached.text))
}

/**
 * The media files in a folder and its subfolders, as paths inside the folder
 * with "/". A subfolder that cannot be read is skipped.
 */
export async function mediaFiles(folder: string, dir = '', depth = 0, found: string[] = []): Promise<string[]> {
  const list = await readdir(join(folder, dir), { withFileTypes: true }).catch((err) => {
    if (!dir) throw err
    return []
  })
  for (const e of list) {
    if (found.length >= maxFiles) break
    const rel = dir ? `${dir}/${e.name}` : e.name
    if (e.isFile() && itemType(e.name)) found.push(rel)
    else if (e.isDirectory() && depth < maxDepth && !isSkippedDir(e.name)) await mediaFiles(folder, rel, depth + 1, found)
  }
  return found
}

async function build(ix: FolderIndex): Promise<void> {
  const names = (await mediaFiles(ix.folder)).sort(byFileName)
  let done = 0
  let lastReport = 0
  // A few files at the same time: faster on a network share, still light.
  const queue = [...names]
  const worker = async () => {
    for (let rel = queue.shift(); rel; rel = queue.shift()) {
      await indexOne(ix, rel)
      done++
      if (Date.now() - lastReport > 300) {
        lastReport = Date.now()
        ix.progress = done / names.length
        notify(ix.folder)
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  // Forget files that are gone.
  const present = new Set(names)
  for (const rel of Object.keys(ix.cache)) if (!present.has(rel)) delete ix.cache[rel]
  ix.progress = null
  scheduleSave(ix)
  notify(ix.folder)
}

/** Start (or reuse) the index and the watcher of a folder. */
export function openFolderIndex(folder: string): void {
  if (indexes.has(folder)) return
  let cache: Record<string, Indexed> = {}
  try {
    const file = indexFile(folder)
    if (existsSync(file)) cache = (JSON.parse(readFileSync(file, 'utf8')) as { files: Record<string, Indexed> }).files ?? {}
  } catch {
    // Damaged index: build it again.
  }
  const ix: FolderIndex = { folder, entries: new Map(), cache, progress: 0, watcher: null, saveTimer: null }
  indexes.set(folder, ix)
  void build(ix).catch((err) => {
    console.error('Could not index', folder, err)
    ix.progress = null
    notify(folder)
  })

  // Network folders need polling; local folders get events from the system.
  ix.watcher = watch(folder, {
    depth: maxDepth,
    ignoreInitial: true,
    usePolling: folder.startsWith('\\\\'),
    interval: 3000,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
    ignored: (path, stats) => path !== folder && (stats?.isFile() ? !itemType(path) : isSkippedDir(basename(path)))
  })
  const relOf = (path: string) => relative(folder, path).split(sep).join('/')
  const update = (path: string) => void indexOne(ix, relOf(path)).then(() => (scheduleSave(ix), notify(folder)))
  ix.watcher.on('add', update)
  ix.watcher.on('change', update)
  ix.watcher.on('unlink', (path) => {
    ix.entries.delete(relOf(path))
    delete ix.cache[relOf(path)]
    scheduleSave(ix)
    notify(folder)
  })
}

export function closeFolderIndex(folder: string): void {
  const ix = indexes.get(folder)
  void ix?.watcher?.close()
  indexes.delete(folder)
}

export function folderStatus(folder: string): { count: number; progress: number | null } {
  const ix = indexes.get(folder)
  return { count: ix?.entries.size ?? 0, progress: ix ? ix.progress : null }
}

/**
 * Search: a number alone puts that number first; words must all appear in the
 * title or the text (title matches first). Accents and case are ignored.
 * An empty query returns all files, so the list can show every subfolder.
 */
export function searchFolder(folder: string, query: string, limit = 200): FolderEntry[] {
  const ix = indexes.get(folder)
  if (!ix) return []
  const all = [...ix.entries.values()].sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || byFileName(a.name, b.name))
  const q = normalize(query.trim())
  let list = all
  if (/^\d+$/.test(q)) {
    const n = Number(q)
    const exact = all.filter((e) => e.number === n)
    const starts = all.filter((e) => e.number !== n && e.number !== null && String(e.number).startsWith(q))
    const inText = all.filter((e) => !exact.includes(e) && !starts.includes(e) && e.norm.includes(q))
    list = [...exact, ...starts, ...inText]
  } else if (q) {
    const words = q.split(/\s+/).filter(Boolean)
    const matches = all.filter((e) => words.every((w) => e.norm.includes(w)))
    const inTitle = matches.filter((e) => words.every((w) => e.normTitle.includes(w)))
    list = [...inTitle, ...matches.filter((e) => !inTitle.includes(e))]
  }
  return (q ? list.slice(0, limit) : list).map(({ norm: _n, normTitle: _t, ...e }) => e)
}
