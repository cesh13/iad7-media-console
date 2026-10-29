import { app } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, join, relative, sep } from 'node:path'
import type { SharedEntry, SharedState } from '../shared/types'
import { byFileName, itemType } from './fileTypes'
import { prepareFile } from './prepare'

/**
 * The shared folder (SPEC 5.2), for example \\MEDIA-PC\Compartida: other
 * people put files here during the week. The app watches it, copies each
 * new file to the local cache at once, and converts .pptx at once, so the
 * file is ready when it is added to the order.
 * The name of the computer that wrote a file is not known; do not depend on it.
 */

/** A folder is "ready" when nothing inside changed for this long. */
const quietMs = 5000
const retryMs = 15000
/** A file counts only when its size did not change for this long (copy finished). */
const stableMs = 3000
/**
 * More media files than this: it is not a shared folder for the service (for
 * example someone chose Documents). Stop, so the app does not copy all of it
 * to the cache.
 */
const maxFiles = 1000
/** Folders that never hold service files. Folders that start with "." are skipped too (.git). */
const skippedDirs = new Set(['node_modules', '$recycle.bin', 'system volume information'])

let root: string | null = null
let watcher: FSWatcher | null = null
let status: SharedState['status'] = 'off'
let error: string | undefined
const entries = new Map<string, SharedEntry>()
/** Last change time of each folder (relative path, '' = the root). */
const lastChange = new Map<string, number>()
/** Files the team has seen (added to the order, or marked seen). Others are "new". */
let known = new Set<string>()
const queue: string[] = []
let preparing = false
/** True during the first look at the folder. Files are copied only after it. */
let scanning = false
let fileCount = 0
let retryTimer: NodeJS.Timeout | null = null
let quietTimer: NodeJS.Timeout | null = null
let notifyTimer: NodeJS.Timeout | null = null
let notify: () => void = () => {}

export function onSharedChanged(callback: () => void): void {
  notify = callback
}

/** Send changes at most 4 times a second. */
function changed(): void {
  if (notifyTimer) return
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    notify()
  }, 250)
}

const knownFile = () => join(app.getPath('userData'), 'shared-known.json')

function loadKnown(): void {
  try {
    const data = existsSync(knownFile()) ? (JSON.parse(readFileSync(knownFile(), 'utf8')) as { root: string; files: string[] }) : null
    known = new Set(data && data.root === root ? data.files : [])
  } catch {
    known = new Set()
  }
}

function saveKnown(): void {
  writeFileSync(knownFile(), JSON.stringify({ root, files: [...known] }), 'utf8')
}

function rel(path: string): string {
  return relative(root!, path).split(sep).join('/')
}

function parentOf(r: string): string {
  const i = r.lastIndexOf('/')
  return i < 0 ? '' : r.slice(0, i)
}

/** A change in a folder also changes all folders above it. */
function touch(r: string): void {
  const now = Date.now()
  for (let p = parentOf(r); ; p = parentOf(p)) {
    lastChange.set(p, now)
    if (p === '') break
  }
  scheduleQuietCheck()
}

function scheduleQuietCheck(): void {
  if (quietTimer) clearTimeout(quietTimer)
  quietTimer = setTimeout(() => {
    quietTimer = null
    for (const e of entries.values()) if (e.dir) e.ready = isQuiet(e.rel)
    changed()
  }, quietMs + 100)
}

function isQuiet(r: string): boolean {
  return Date.now() - (lastChange.get(r) ?? 0) >= quietMs
}

/** Copy and convert one file at a time, so the network and the computer stay free. */
async function runQueue(): Promise<void> {
  if (preparing || scanning) return
  preparing = true
  while (queue.length) {
    const r = queue.shift()!
    const e = entries.get(r)
    if (!e || e.dir || !e.type || !root) continue
    try {
      await prepareFile(join(root, r), e.type, (state, fraction) => {
        e.state = state
        e.progress = fraction
        changed()
      })
      e.state = 'ready'
      e.error = undefined
    } catch (err) {
      e.state = 'error'
      e.error = err instanceof Error ? err.message : String(err)
    }
    e.progress = undefined
    changed()
  }
  preparing = false
}

function addEntry(path: string, dir: boolean, mtime?: number): void {
  if (status === 'tooBig') return
  const r = rel(path)
  if (!r || r.startsWith('..')) return
  const type = dir ? null : itemType(path)
  if (!dir && !type) return // Thumbs.db, desktop.ini, ~$ files, unknown types.
  if (!dir && !entries.has(r) && ++fileCount > maxFiles) {
    stopTooBig()
    return
  }
  entries.set(r, {
    rel: r,
    path,
    name: basename(path),
    parent: parentOf(r),
    dir,
    type,
    isNew: !dir && !known.has(r),
    mtime,
    state: dir ? 'ready' : 'waiting',
    ready: dir ? false : undefined
  })
  touch(r)
  if (!dir) {
    queue.push(r)
    void runQueue()
  }
  changed()
}

function removeEntry(path: string): void {
  const r = rel(path)
  // Rename or move = delete + new. Items already in the order are not touched.
  for (const [key, e] of [...entries]) {
    if (key !== r && !key.startsWith(`${r}/`)) continue
    entries.delete(key)
    if (!e.dir) fileCount--
  }
  touch(r)
  changed()
}

function stopWatcher(): void {
  void watcher?.close()
  watcher = null
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}

/** The folder has too many media files: stop watching and copy nothing more. */
function stopTooBig(): void {
  stopWatcher()
  status = 'tooBig'
  error = undefined
  scanning = false
  entries.clear()
  queue.length = 0
  changed()
}

/** True for folders and files the watcher does not look at. */
function isSkipped(path: string, stats?: { isFile(): boolean }): boolean {
  if (path === root) return false
  // Files the app cannot show (code, documents, …) are not even polled.
  if (stats?.isFile()) return !itemType(path)
  const name = basename(path).toLowerCase()
  return name.startsWith('.') || name.startsWith('~$') || skippedDirs.has(name) || name === 'thumbs.db' || name === 'desktop.ini'
}

async function startWatcher(): Promise<void> {
  stopWatcher()
  entries.clear()
  queue.length = 0
  fileCount = 0
  if (!root) return
  const reachable = await stat(root)
    .then((s) => s.isDirectory())
    .catch(() => false)
  if (!reachable) {
    status = 'unreachable'
    error = undefined
    changed()
    retryTimer = setTimeout(() => void startWatcher(), retryMs)
    return
  }
  status = 'scanning'
  error = undefined
  scanning = true
  // Network folders do not send change events: poll them.
  const w = watch(root, {
    depth: 3,
    usePolling: root.startsWith('\\\\'),
    interval: 2000,
    binaryInterval: 3000,
    // A file counts only when its size stopped changing (copy finished).
    awaitWriteFinish: { stabilityThreshold: stableMs, pollInterval: 500 },
    ignored: isSkipped
  })
  watcher = w
  w.on('ready', () => {
    // The files found in the first look arrive a little later (awaitWriteFinish).
    // Start copying only when they are all in, so a folder that is too big is
    // stopped before anything is copied.
    setTimeout(() => {
      if (watcher !== w || status === 'tooBig') return
      scanning = false
      status = 'watching'
      changed()
      void runQueue()
    }, stableMs + 1000)
  })
  w.on('add', (p, s) => addEntry(p, false, s?.mtimeMs))
  w.on('change', (p, s) => addEntry(p, false, s?.mtimeMs))
  w.on('addDir', (p) => addEntry(p, true))
  w.on('unlink', removeEntry)
  w.on('unlinkDir', removeEntry)
  w.on('error', (err) => {
    // The share went away (network, other computer off): try again later.
    status = 'unreachable'
    error = err instanceof Error ? err.message : String(err)
    changed()
    stopWatcher()
    retryTimer = setTimeout(() => void startWatcher(), retryMs)
  })
  changed()
}

export function setSharedFolder(path: string | null): void {
  root = path?.trim() || null
  status = root ? 'scanning' : 'off'
  loadKnown()
  void startWatcher()
}

export function sharedState(): SharedState {
  // Show only folders that have a media file somewhere inside.
  const withFiles = new Set<string>()
  for (const e of entries.values()) {
    if (e.dir) continue
    for (let p = e.parent; p !== '' && !withFiles.has(p); p = parentOf(p)) withFiles.add(p)
  }
  const list = [...entries.values()]
    .filter((e) => !e.dir || withFiles.has(e.rel))
    .sort((a, b) => (a.dir === b.dir ? byFileName(a.name, b.name) : a.dir ? -1 : 1))
  return { root, status, error, entries: list }
}

/** Files of one folder of the share, in file-name order (for the "All" button). */
export function sharedFilesIn(folderRel: string): string[] {
  return [...entries.values()].filter((e) => !e.dir && e.parent === folderRel).sort((a, b) => byFileName(a.name, b.name)).map((e) => e.path)
}

/** Mark files as seen (no "new" dot). No list: all files. */
export function markSeen(paths?: string[]): void {
  for (const e of entries.values()) {
    if (e.dir) continue
    if (paths && !paths.includes(e.path)) continue
    e.isNew = false
    known.add(e.rel)
  }
  saveKnown()
  changed()
}

export function stopShared(): void {
  stopWatcher()
}
