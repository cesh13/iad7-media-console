import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  AddFilesResult,
  Group,
  ItemStatus,
  ItemType,
  PlaybackInfo,
  Service,
  ServiceItem,
  ServiceState
} from '../shared/types'
import { cacheFile, mediaUrl } from './cache'
import { saveService } from './serviceStore'

// The service order and the live state. The main process owns this state;
// windows only show it and send commands.

const typeByExtension: Record<string, ItemType> = {
  '.mp4': 'video',
  '.m4v': 'video',
  '.mov': 'video',
  '.webm': 'video',
  '.mkv': 'video',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.bmp': 'image'
}

const ignoredNames = new Set(['thumbs.db', 'desktop.ini', '.ds_store'])

let service: Service
const group: Group = { id: 'main', name: 'Main', outputIds: [], live: null }
let playback: PlaybackInfo | null = null
let take = 0
let seekId = 0

let notify: (outputsChanged: boolean) => void = () => {}
let saveTimer: NodeJS.Timeout | null = null

/** `outputsChanged` is false when only the control window needs an update. */
export function onServiceChanged(callback: (outputsChanged: boolean) => void): void {
  notify = callback
}

function changed(options: { save?: boolean; outputs?: boolean } = {}): void {
  if (options.save !== false) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveService(service), 300)
  }
  notify(options.outputs !== false)
}

export function flushSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  if (service) saveService(service)
}

export function initService(loaded: Service): void {
  service = loaded
  for (const item of service.items) {
    // Nothing is live when the app starts.
    if (item.status === 'live') item.status = 'pending'
    // Copy again if the app stopped during a copy, or the cache was cleared.
    if (item.cache !== 'ready' || !item.localCopyPath || !existsSync(item.localCopyPath)) startCopy(item)
    else item.url = mediaUrl(item.localCopyPath)
  }
}

export function setGroupOutputs(outputIds: string[]): void {
  group.outputIds = outputIds
}

export function getGroup(): Group {
  return group
}

export function findItem(itemId: string): ServiceItem | undefined {
  return service.items.find((i) => i.id === itemId)
}

export function serviceState(): ServiceState {
  const next = nextIndex()
  return { service, group, playback, nextItemId: next >= 0 ? service.items[next].id : null }
}

// ---- Adding and changing items ----

function itemType(path: string): ItemType | null {
  const name = basename(path).toLowerCase()
  if (ignoredNames.has(name) || name.startsWith('~$')) return null
  return typeByExtension[extname(name)] ?? null
}

/** Sort by file name the way people expect: "2" before "10". */
function byFileName(a: string, b: string): number {
  return basename(a).localeCompare(basename(b), undefined, { numeric: true, sensitivity: 'base' })
}

/** Add files. A folder adds the files inside it (not subfolders), in file-name order. */
export async function addFiles(paths: string[]): Promise<AddFilesResult> {
  const files: string[] = []
  for (const p of [...paths].sort(byFileName)) {
    const info = await stat(p).catch(() => null)
    if (!info) continue
    if (info.isDirectory()) {
      const entries = await readdir(p, { withFileTypes: true })
      files.push(...entries.filter((e) => e.isFile()).map((e) => join(p, e.name)).sort(byFileName))
    } else {
      files.push(p)
    }
  }

  const result: AddFilesResult = { added: 0, skipped: [] }
  for (const path of files) {
    const type = itemType(path)
    if (!type) {
      result.skipped.push(basename(path))
      continue
    }
    const item: ServiceItem = {
      id: randomUUID(),
      type,
      title: basename(path, extname(path)),
      path,
      cache: 'copying',
      cacheProgress: 0,
      status: 'pending'
    }
    service.items.push(item)
    startCopy(item)
    result.added++
  }
  changed()
  return result
}

function startCopy(item: ServiceItem): void {
  item.cache = 'copying'
  item.cacheProgress = 0
  item.cacheError = undefined
  item.url = undefined
  cacheFile(item.path, (fraction) => {
    item.cacheProgress = fraction
    changed({ save: false, outputs: false })
  })
    .then((cached) => {
      item.localCopyPath = cached
      item.url = mediaUrl(cached)
      item.cache = 'ready'
      item.cacheProgress = undefined
      changed()
    })
    .catch((err: Error) => {
      item.cache = 'error'
      item.cacheProgress = undefined
      item.cacheError = err.message
      changed()
    })
}

export function retryCopy(itemId: string): void {
  const item = findItem(itemId)
  if (item && item.cache === 'error') startCopy(item)
  changed()
}

export function removeItem(itemId: string): void {
  if (group.live?.itemId === itemId) clearLive(false)
  service.items = service.items.filter((i) => i.id !== itemId)
  changed()
}

export function moveItem(itemId: string, toIndex: number): void {
  const from = service.items.findIndex((i) => i.id === itemId)
  if (from < 0) return
  const [item] = service.items.splice(from, 1)
  service.items.splice(Math.max(0, Math.min(toIndex, service.items.length)), 0, item)
  changed()
}

export function setItemStatus(itemId: string, status: ItemStatus): void {
  const item = findItem(itemId)
  if (!item) return
  if (status === 'live') return goLive(itemId)
  if (group.live?.itemId === itemId) clearLive(false)
  item.status = status
  changed()
}

export function setDuration(itemId: string, seconds: number): void {
  const item = findItem(itemId)
  if (!item || !Number.isFinite(seconds) || item.duration === seconds) return
  item.duration = seconds
  changed({ outputs: false })
}

// ---- Live ----

function isReady(item: ServiceItem): boolean {
  return item.cache === 'ready' && !!item.localCopyPath
}

function liveIndex(): number {
  return group.live ? service.items.findIndex((i) => i.id === group.live!.itemId) : -1
}

/**
 * The item that "Next" makes live: the item after the live one, or,
 * when nothing is live, the first pending item. Items that are not copied yet are skipped.
 */
function nextIndex(): number {
  const live = liveIndex()
  const items = service.items
  for (let i = live >= 0 ? live + 1 : 0; i < items.length; i++) {
    if (!isReady(items[i])) continue
    if (live >= 0 || items[i].status === 'pending') return i
  }
  return -1
}

export function goLive(itemId: string): void {
  const item = findItem(itemId)
  if (!item || !isReady(item)) return
  const current = group.live && findItem(group.live.itemId)
  if (current && current.id !== item.id) current.status = 'done'
  item.status = 'live'
  group.live = { itemId: item.id, take: ++take, playing: true }
  playback = null
  changed()
}

export function next(): void {
  const i = nextIndex()
  if (i >= 0) goLive(service.items[i].id)
  else if (group.live) clearLive(true) // The last item ended: go to idle.
}

export function previous(): void {
  const items = service.items
  const live = liveIndex()
  const anchor = live >= 0 ? live : nextIndex() >= 0 ? nextIndex() : items.length
  for (let i = anchor - 1; i >= 0; i--) {
    if (isReady(items[i])) return goLive(items[i].id)
  }
}

/** Stop showing the live item. The group shows its idle screen (black for now). */
export function clearLive(markDone = true): void {
  if (!group.live) return
  const item = findItem(group.live.itemId)
  if (item && markDone) item.status = 'done'
  group.live = null
  playback = null
  changed()
}

export function setPlaying(playing: boolean): void {
  if (!group.live) return
  group.live = { ...group.live, playing }
  changed({ save: false })
}

export function seek(seconds: number): void {
  if (!group.live) return
  group.live = { ...group.live, seekTo: Math.max(0, seconds), seekId: ++seekId }
  changed({ save: false })
}

/** Called by the output that plays the sound. */
export function reportPlayback(info: Omit<PlaybackInfo, 'itemId'> & { ended: boolean }): void {
  const live = group.live
  if (!live || info.take !== live.take) return
  if (info.duration) setDuration(live.itemId, info.duration)
  if (info.ended) {
    // Default "when it ends" action: mark done and go to the idle screen.
    clearLive(true)
    return
  }
  playback = { itemId: live.itemId, take: info.take, currentTime: info.currentTime, duration: info.duration, playing: info.playing }
  notify(false)
}
