import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  AddFilesResult,
  GroupConfig,
  GroupLive,
  ItemSettings,
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
/** Timers for images with "next item after N s", by take. */
const autoNextTimers = new Map<number, NodeJS.Timeout>()

let getGroups: () => GroupConfig[] = () => []
let logoUrl: () => string | undefined = () => undefined
let notify: (outputsChanged: boolean) => void = () => {}
let saveTimer: NodeJS.Timeout | null = null

export function connectService(options: {
  groups: () => GroupConfig[]
  logoUrl: () => string | undefined
  onChange: (outputsChanged: boolean) => void
}): void {
  getGroups = options.groups
  logoUrl = options.logoUrl
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

export function defaultSettings(type: ItemType): ItemSettings {
  if (type === 'video') return { autoDone: true, volume: 1, endAction: 'idle', fade: false, cues: [] }
  return { autoDone: true, fit: 'fit', autoNext: null }
}

export function initService(loaded: Service): void {
  service = loaded
  for (const item of service.items) {
    // Services from steps 2 and 3 have no settings yet.
    item.settings = { ...defaultSettings(item.type), ...item.settings }
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
    logoUrl: logoUrl()
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
      status: 'pending',
      settings: defaultSettings(type)
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

export function updateItem(
  itemId: string,
  change: { notes?: string; settings?: Partial<ItemSettings>; width?: number; height?: number }
): void {
  const item = findItem(itemId)
  if (!item) return
  if (change.notes !== undefined) item.notes = change.notes
  if (change.width) item.width = change.width
  if (change.height) item.height = change.height
  if (change.settings) {
    item.settings = { ...item.settings, ...change.settings }
    // Groups that show the item use the new settings at once.
    for (const g of live.values()) if (g.content?.itemId === itemId) g.content.settings = item.settings
  }
  changed({ outputs: !!change.settings })
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
    if (item && !now.has(id)) item.status = markDone && item.settings.autoDone ? 'done' : 'pending'
  }
  // Forget playback of takes that no group shows.
  const takes = new Set([...live.values()].map((g) => g.content?.take))
  for (const t of [...playback.keys()]) if (!takes.has(t)) playback.delete(t)
  for (const [t, timer] of autoNextTimers) {
    if (takes.has(t)) continue
    clearTimeout(timer)
    autoNextTimers.delete(t)
  }
}

function targetGroupIds(t: Target = target): string[] {
  const groups = getGroups()
  if (t !== 'all') return groups.filter((g) => g.id === t).map((g) => g.id)
  // "All" means the groups that have screens (or all groups, if none has one yet).
  const withScreens = groups.filter((g) => g.outputIds.length > 0)
  return (withScreens.length ? withScreens : groups).map((g) => g.id)
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

export function goLive(itemId: string, t?: Target): void {
  goLiveIn(targetGroupIds(t), itemId)
}

function goLiveIn(groupIds: string[], itemId: string): void {
  const item = findItem(itemId)
  if (!item || !isReady(item) || groupIds.length === 0) return
  const before = liveItemIds()
  const t = ++take
  for (const id of groupIds) {
    live.set(id, {
      ...groupLive(id),
      content: { itemId: item.id, type: item.type, url: item.url!, settings: item.settings, take: t, playing: true }
    })
  }
  updateStatuses(before, true)
  if (item.type === 'image' && item.settings.autoNext) {
    autoNextTimers.set(t, setTimeout(() => advanceFrom(t), item.settings.autoNext * 1000))
  }
  changed()
}

function groupsWithTake(t: number): string[] {
  return [...live].filter(([, g]) => g.content?.take === t).map(([id]) => id)
}

/** The groups that show this take go to the item after it (or to idle after the last item). */
function advanceFrom(t: number): void {
  const groupIds = groupsWithTake(t)
  const itemId = groupIds.length ? live.get(groupIds[0])!.content!.itemId : null
  if (!itemId) return
  const items = service.items
  const from = items.findIndex((i) => i.id === itemId)
  const nextItem = items.slice(from + 1).find(isReady)
  if (nextItem) goLiveIn(groupIds, nextItem.id)
  else clearGroups(groupIds, true)
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
  const groupIds = groupsWithTake(info.take)
  if (groupIds.length === 0) return
  const content = live.get(groupIds[0])!.content!
  if (info.duration) setDuration(content.itemId, info.duration)
  if (content.ended) return
  if (info.ended) return videoEnded(info.take, content.settings)
  playback.set(info.take, { take: info.take, currentTime: info.currentTime, duration: info.duration, playing: info.playing })
  notify(false)
}

/** Do the "when it ends" action of the item. */
function videoEnded(t: number, settings: ItemSettings): void {
  const groupIds = groupsWithTake(t)
  switch (settings.endAction ?? 'idle') {
    case 'next':
      return advanceFrom(t)
    case 'black':
    case 'hold': {
      // Keep the item on the content layer: the output shows black or the last frame.
      for (const id of groupIds) {
        const c = live.get(id)!.content!
        c.ended = true
        c.playing = false
      }
      const item = findItem(live.get(groupIds[0])!.content!.itemId)
      if (item && settings.autoDone) item.status = 'done'
      playback.delete(t)
      return changed({ save: false })
    }
    case 'loop':
      return // The output loops the video itself; it never reports the end.
    default:
      return clearGroups(groupIds, true)
  }
}
