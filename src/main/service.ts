import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  AddFilesResult,
  GroupConfig,
  GroupLive,
  ItemStatus,
  ItemType,
  Overlays,
  PlaybackInfo,
  Service,
  ServiceItem,
  ServiceState,
  Target
} from '../shared/types'
import { cacheFile, mediaUrl } from './cache'
import { saveService } from './serviceStore'

// The service order and the live state of each group. The main process owns
// this state; windows only show it and send commands.

export const typeByExtension: Record<string, ItemType> = {
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
/** Live state by group id. */
const live = new Map<string, GroupLive>()
const playback = new Map<number, PlaybackInfo>()
let target: Target = 'all'
const overlays: Overlays = { black: false, logo: false }
let take = 0
let seekId = 0

let getGroups: () => GroupConfig[] = () => []
let hasLogo: () => boolean = () => false
let notify: (outputsChanged: boolean) => void = () => {}
let saveTimer: NodeJS.Timeout | null = null

export function connectService(options: {
  groups: () => GroupConfig[]
  hasLogo: () => boolean
  onChange: (outputsChanged: boolean) => void
}): void {
  getGroups = options.groups
  hasLogo = options.hasLogo
  notify = options.onChange
}

/** Call after the outputs, groups, logo or idle files change. */
export function groupsChanged(): void {
  const ids = new Set(getGroups().map((g) => g.id))
  for (const id of [...live.keys()]) if (!ids.has(id)) clearGroups([id], true)
  if (target !== 'all' && !ids.has(target)) target = 'all'
  changed({ save: false })
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

export function groupLive(groupId: string): GroupLive {
  return live.get(groupId) ?? { content: null }
}

export function getOverlays(): Overlays {
  return overlays
}

export function findItem(itemId: string): ServiceItem | undefined {
  return service.items.find((i) => i.id === itemId)
}

export function serviceState(): ServiceState {
  const next = nextIndex()
  return {
    service,
    groups: getGroups().map((config) => ({ config, live: groupLive(config.id) })),
    target,
    playback: Object.fromEntries(playback),
    nextItemId: next >= 0 ? service.items[next].id : null,
    overlays,
    logoReady: hasLogo()
  }
}

// ---- Adding and changing items ----

function itemType(path: string): ItemType | null {
  const name = basename(path).toLowerCase()
  if (ignoredNames.has(name) || name.startsWith('~$')) return null
  return typeByExtension[extname(name)] ?? null
}

/** Sort by file name the way people expect: "2" before "10". */
export function byFileName(a: string, b: string): number {
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
  clearGroups(groupsShowing(itemId), false)
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
  clearGroups(groupsShowing(itemId), false)
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
  return item.cache === 'ready' && !!item.url
}

function liveItemIds(): Set<string> {
  const ids = new Set<string>()
  for (const g of live.values()) if (g.content) ids.add(g.content.itemId)
  return ids
}

function groupsShowing(itemId: string): string[] {
  return [...live].filter(([, g]) => g.content?.itemId === itemId).map(([id]) => id)
}

/** Items that were live and are not live in any group now get "done" (or "pending"). */
function updateStatuses(before: Set<string>, markDone: boolean): void {
  const now = liveItemIds()
  for (const id of now) {
    const item = findItem(id)
    if (item) item.status = 'live'
  }
  for (const id of before) {
    const item = findItem(id)
    if (item && !now.has(id)) item.status = markDone ? 'done' : 'pending'
  }
  // Forget playback of takes that no group shows.
  const takes = new Set([...live.values()].map((g) => g.content?.take))
  for (const t of [...playback.keys()]) if (!takes.has(t)) playback.delete(t)
}

function targetGroupIds(t: Target = target): string[] {
  const groups = getGroups()
  return t === 'all' ? groups.map((g) => g.id) : groups.filter((g) => g.id === t).map((g) => g.id)
}

/**
 * The group that "Next" and "Previous" follow: the target group, or, for
 * "all", the first group that shows something.
 */
function referenceLive(): GroupLive | undefined {
  const ids = targetGroupIds()
  const showing = ids.find((id) => groupLive(id).content)
  return groupLive(showing ?? ids[0] ?? '')
}

function liveIndex(): number {
  const content = referenceLive()?.content
  return content ? service.items.findIndex((i) => i.id === content.itemId) : -1
}

/**
 * The item that "Next" makes live: the item after the live one, or,
 * when nothing is live, the first pending item. Items that are not copied yet are skipped.
 */
function nextIndex(): number {
  const current = liveIndex()
  const items = service.items
  for (let i = current >= 0 ? current + 1 : 0; i < items.length; i++) {
    if (!isReady(items[i])) continue
    if (current >= 0 || items[i].status === 'pending') return i
  }
  return -1
}

export function setTarget(t: Target): void {
  target = t === 'all' || getGroups().some((g) => g.id === t) ? t : 'all'
  changed({ save: false, outputs: false })
}

export function goLive(itemId: string): void {
  const item = findItem(itemId)
  const ids = targetGroupIds()
  if (!item || !isReady(item) || ids.length === 0) return
  const before = liveItemIds()
  take++
  for (const id of ids) {
    live.set(id, { ...groupLive(id), content: { itemId: item.id, type: item.type, url: item.url!, take, playing: true } })
  }
  updateStatuses(before, true)
  changed()
}

export function next(): void {
  const i = nextIndex()
  if (i >= 0) goLive(service.items[i].id)
  else clearGroups(targetGroupIds(), true) // The last item ended: go to idle.
}

export function previous(): void {
  const items = service.items
  const current = liveIndex()
  const nextI = nextIndex()
  const anchor = current >= 0 ? current : nextI >= 0 ? nextI : items.length
  for (let i = anchor - 1; i >= 0; i--) {
    if (isReady(items[i])) return goLive(items[i].id)
  }
}

/** Stop showing content in these groups. They show their idle screen. */
function clearGroups(groupIds: string[], markDone: boolean): void {
  const before = liveItemIds()
  let any = false
  for (const id of groupIds) {
    const g = live.get(id)
    if (g?.content) {
      live.set(id, { ...g, content: null })
      any = true
    }
  }
  if (!any) return
  updateStatuses(before, markDone)
  changed()
}

export function clear(groupId?: string): void {
  clearGroups(groupId ? [groupId] : targetGroupIds(), true)
}

/** Change the content of every group that shows this take. */
function updateTake(t: number, change: (c: NonNullable<GroupLive['content']>) => void): void {
  for (const g of live.values()) if (g.content?.take === t) change(g.content)
  changed({ save: false })
}

export function setPlaying(t: number, playing: boolean): void {
  updateTake(t, (c) => (c.playing = playing))
}

export function seek(t: number, seconds: number): void {
  const id = ++seekId
  updateTake(t, (c) => {
    c.seekTo = Math.max(0, seconds)
    c.seekId = id
  })
}

export function setOverlay(name: keyof Overlays, on: boolean): void {
  overlays[name] = on
  changed({ save: false })
}

/** Called by the output that plays the sound of a take. */
export function reportPlayback(info: PlaybackInfo & { ended: boolean }): void {
  const groupIds = [...live].filter(([, g]) => g.content?.take === info.take).map(([id]) => id)
  if (groupIds.length === 0) return
  const itemId = live.get(groupIds[0])!.content!.itemId
  if (info.duration) setDuration(itemId, info.duration)
  if (info.ended) {
    // Default "when it ends" action: mark done and go to the idle screen.
    clearGroups(groupIds, true)
    return
  }
  playback.set(info.take, { take: info.take, currentTime: info.currentTime, duration: info.duration, playing: info.playing })
  notify(false)
}
