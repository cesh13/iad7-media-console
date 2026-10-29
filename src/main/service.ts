import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { byFileName, itemType } from './fileTypes'
import { readTextFile } from './fileText'
import { folderStatus, openFolderIndex } from './folderIndex'
import { refLabel } from '../shared/bibleBooks'
import type {
  AddFilesResult,
  BibleRef,
  BibleScreen,
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
  Target,
  TextLayer
} from '../shared/types'
import { bibleDefaults, buildScreens, listBibles } from './bible'
import { cacheFile, mediaUrl } from './cache'
import { renderPdfPages } from './pdfPages'
import { convertToPdf } from './pptx'
import { saveService } from './serviceStore'

// The service order and the live state of each group. The main process owns
// this state; windows only show it and send commands.

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
  if (type === 'slides') return { autoDone: true, autoAdvance: null, loop: false }
  if (type === 'bible') return bibleDefaults()
  if (type === 'song') return { ...bibleDefaults(), refPosition: 'hide', versesPerScreen: 1 }
  if (type === 'folder') return { autoDone: true }
  return { autoDone: true, fit: 'fit', autoNext: null }
}

export function initService(loaded: Service): void {
  service = loaded
  for (const item of service.items) {
    // Services from steps 2 and 3 have no settings yet.
    item.settings = { ...defaultSettings(item.type), ...item.settings }
    // Nothing is live when the app starts.
    if (item.status === 'live') item.status = 'pending'
    if (item.type === 'bible') continue // No file to copy.
    if (item.type === 'folder') {
      openFolderIndex(item.path)
      if (item.child) restoreItem(item.child)
      continue
    }
    restoreItem(item)
  }
}

/** Copy again if the app stopped during a copy, or the cache was cleared. */
function restoreItem(item: ServiceItem): void {
  item.settings = { ...defaultSettings(item.type), ...item.settings }
  if (item.status === 'live') item.status = 'pending'
  const pagesMissing = item.type === 'slides' && !item.pageUrls?.length
  if (item.cache !== 'ready' || !item.localCopyPath || !existsSync(item.localCopyPath) || pagesMissing) startCopy(item)
  else if (item.type !== 'slides') item.url = mediaUrl(item.localCopyPath)
}

export function groupLive(groupId: string): GroupLive {
  return live.get(groupId) ?? { content: null, text: null }
}

export function getOverlays(): Overlays {
  return overlays
}

/** An item of the order, or the chosen file of a folder item. */
export function findItem(itemId: string): ServiceItem | undefined {
  for (const i of service.items) {
    if (i.id === itemId) return i
    if (i.child?.id === itemId) return i.child
  }
  return undefined
}

/** Position in the order. The chosen file of a folder has the position of its folder. */
function orderIndex(itemId: string): number {
  return service.items.findIndex((i) => i.id === itemId || i.child?.id === itemId)
}

/** What goes live for an order item: the item itself, or the chosen file of a folder. */
function playable(item: ServiceItem): ServiceItem | undefined {
  return item.type === 'folder' ? item.child : item
}

/** Set the status of an item; a chosen file also sets its folder. */
function setStatus(itemId: string, status: ItemStatus): void {
  for (const i of service.items) {
    if (i.id === itemId) i.status = status
    if (i.child?.id === itemId) {
      i.child.status = status
      i.status = status
    }
  }
}

export function serviceState(): ServiceState {
  refreshFolders()
  const next = nextIndex()
  return {
    service,
    groups: getGroups().map((config) => ({ config, live: groupLive(config.id) })),
    target,
    playback: Object.fromEntries(playback),
    nextItemId: next >= 0 ? service.items[next].id : null,
    overlays,
    logoUrl: logoUrl(),
    bibles: listBibles(),
    bibleHistory: service.bibleHistory ?? []
  }
}

// ---- Adding and changing items ----

/** A dropped folder with more files than this becomes one searchable folder item. */
const folderItemThreshold = 30

/** Add files. A folder adds the files inside it (not subfolders), in file-name order. */
export async function addFiles(paths: string[]): Promise<AddFilesResult> {
  const files: string[] = []
  let folders = 0
  for (const p of [...paths].sort(byFileName)) {
    const info = await stat(p).catch(() => null)
    if (!info) continue
    if (info.isDirectory()) {
      const entries = await readdir(p, { withFileTypes: true })
      const inside = entries.filter((e) => e.isFile()).map((e) => join(p, e.name)).sort(byFileName)
      // A big folder (the hymnal) is one item with search; a small folder adds its files.
      if (inside.filter((f) => itemType(f)).length > folderItemThreshold) {
        addFolder(p)
        folders++
      } else {
        files.push(...inside)
      }
    } else {
      files.push(p)
    }
  }

  const result: AddFilesResult = { added: folders, skipped: [] }
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

/** A folder as one item: pick one file from it with a search (SPEC 5.2). */
export function addFolder(folder: string): void {
  service.items.push({
    id: randomUUID(),
    type: 'folder',
    title: basename(folder),
    path: folder,
    cache: 'ready',
    status: 'pending',
    settings: defaultSettings('folder')
  })
  openFolderIndex(folder)
  changed()
}

/** Choose the file of a folder item. It is copied (and converted) like any other item. */
export function chooseInFolder(itemId: string, path: string): void {
  const folder = findItem(itemId)
  const type = itemType(path)
  if (!folder || folder.type !== 'folder' || !type || type === 'folder') return
  if (folder.folderChoice === path) return
  const child: ServiceItem = {
    id: randomUUID(),
    type,
    title: basename(path, extname(path)),
    path,
    cache: 'copying',
    cacheProgress: 0,
    status: 'pending',
    settings: defaultSettings(type)
  }
  folder.folderChoice = path
  folder.child = child
  folder.status = 'pending'
  startCopy(child)
  changed()
}

/** Folder counts and index progress, for the order list. */
function refreshFolders(): void {
  for (const item of service.items) if (item.type === 'folder') item.folder = folderStatus(item.path)
}

/** Split song text into stanzas at empty lines. */
function stanzas(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function startCopy(item: ServiceItem): void {
  item.cache = 'copying'
  item.cacheProgress = 0
  item.cacheError = undefined
  item.url = undefined
  const progress = (fraction: number) => {
    item.cacheProgress = fraction
    changed({ save: false, outputs: false })
  }
  cacheFile(item.path, progress)
    .then(async (cached) => {
      item.localCopyPath = cached
      if (item.type === 'song') {
        item.stanzas = stanzas(await readTextFile(cached))
        item.url = mediaUrl(cached)
      } else if (item.type === 'slides') {
        // .pptx: convert to PDF first. Then make one picture per page.
        let pdf = cached
        if (!cached.toLowerCase().endsWith('.pdf')) {
          item.cache = 'converting'
          item.cacheProgress = undefined
          changed({ save: false, outputs: false })
          pdf = await convertToPdf(cached)
        }
        item.cache = 'rendering'
        progress(0)
        const pages = await renderPdfPages(pdf, progress)
        item.pageUrls = pages.pageUrls
        item.pageTexts = pages.texts
        item.url = pages.pageUrls[0]
      } else {
        item.url = mediaUrl(cached)
      }
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
  clearGroups(groupsShowing(itemId), false, 'both')
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
  clearGroups(groupsShowing(itemId), false, 'both')
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
    // Bible text: make the screens again with the new settings, at the same verse.
    for (const g of live.values()) {
      if (g.text?.itemId !== itemId) continue
      if (!item.bible) {
        g.text.settings = item.settings
        continue
      }
      const verse = g.text.screens[g.text.index]?.verse
      g.text.settings = item.settings
      g.text.screens = buildScreens(item.bible, item.settings)
      g.text.index = Math.max(0, g.text.screens.findIndex((s) => s.verse === verse))
    }
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
  if (item.type === 'folder') return !!item.child && isReady(item.child)
  if (item.type === 'song') return item.cache === 'ready' && !!item.stanzas?.length
  if (item.type === 'bible') return !!item.bible && listBibles().some((b) => b.id === item.bible!.bibleId)
  if (item.type === 'slides' && !item.pageUrls?.length) return false
  return item.cache === 'ready' && !!item.url
}

function liveItemIds(): Set<string> {
  const ids = new Set<string>()
  for (const g of live.values()) {
    if (g.content) ids.add(g.content.itemId)
    if (g.text?.itemId) ids.add(g.text.itemId)
  }
  return ids
}

function groupsShowing(itemId: string): string[] {
  return [...live].filter(([, g]) => g.content?.itemId === itemId || g.text?.itemId === itemId).map(([id]) => id)
}

/** Items that were live and are not live in any group now get "done" (or "pending"). */
function updateStatuses(before: Set<string>, markDone: boolean): void {
  const now = liveItemIds()
  for (const id of now) setStatus(id, 'live')
  for (const id of before) {
    const item = findItem(id)
    if (item && !now.has(id)) setStatus(id, markDone && item.settings.autoDone ? 'done' : 'pending')
  }
  // Forget playback of takes that no group shows.
  const takes = new Set([...live.values()].flatMap((g) => [g.content?.take, g.text?.take]))
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
  const showing = ids.find((id) => currentItemId(groupLive(id)))
  return groupLive(showing ?? ids[0] ?? '')
}

/** The order item a group shows: the one that went live last (content or text layer). */
function currentItemId(g: GroupLive): string | null {
  const text = g.text?.itemId ? g.text : null
  if (g.content && (!text || g.content.take > text.take)) return g.content.itemId
  return text?.itemId ?? null
}

function liveIndex(): number {
  const g = referenceLive()
  const id = g ? currentItemId(g) : null
  return id ? orderIndex(id) : -1
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

export function goLive(itemId: string, t?: Target, page = 0): void {
  goLiveIn(targetGroupIds(t), itemId, page)
}

function goLiveIn(groupIds: string[], itemId: string, page = 0): void {
  const found = findItem(itemId)
  const item = found && playable(found)
  if (!item || !isReady(item) || groupIds.length === 0) return
  if (item.type === 'bible') return showText(groupIds, item.id, buildScreens(item.bible!, item.settings), item.settings, item.title, item.bible)
  if (item.type === 'song') return showText(groupIds, item.id, songScreens(item), item.settings, item.title)
  const before = liveItemIds()
  const t = ++take
  for (const id of groupIds) {
    const g = groupLive(id)
    live.set(id, {
      ...g,
      // New content replaces Bible text from the order, and full-screen text.
      text: g.text && (g.text.itemId || g.text.settings.mode !== 'lower') ? null : g.text,
      content: {
        itemId: item.id,
        type: item.type,
        url: item.url!,
        settings: item.settings,
        take: t,
        playing: true,
        ...(item.type === 'slides' ? { page: clampPage(item, page), pageUrls: item.pageUrls } : {})
      }
    })
  }
  updateStatuses(before, true)
  if (item.type === 'image' && item.settings.autoNext) {
    autoNextTimers.set(t, setTimeout(() => advanceFrom(t), item.settings.autoNext * 1000))
  }
  if (item.type === 'slides' && item.settings.autoAdvance) {
    autoNextTimers.set(t, setInterval(() => stepTake(t, 1), item.settings.autoAdvance * 1000))
  }
  changed()
}

function clampPage(item: ServiceItem, page: number): number {
  return Math.max(0, Math.min(page, (item.pageUrls?.length ?? 1) - 1))
}

/**
 * Move the slides of one take forward or back. After the last page: start
 * again (loop), or go to the next item. Before the first page: stay.
 */
function stepTake(t: number, delta: number): void {
  const groupIds = groupsWithTake(t)
  const content = groupIds.length ? live.get(groupIds[0])!.content : null
  const item = content && findItem(content.itemId)
  if (!content || !item || content.type !== 'slides') return
  const count = item.pageUrls?.length ?? 1
  let page = (content.page ?? 0) + delta
  if (page >= count) {
    if (!item.settings.loop) return advanceFrom(t)
    page = 0
  }
  page = Math.max(0, page)
  for (const id of groupIds) live.get(id)!.content!.page = page
  changed({ save: false })
}

/** ← → keys: change the Bible screen, or the page of the slides, live in the target. */
export function pageStep(delta: number): void {
  const textTakes = new Set(
    targetGroupIds()
      .map((id) => groupLive(id).text?.take)
      .filter((t): t is number => t !== undefined)
  )
  if (textTakes.size) {
    for (const t of textTakes) stepText(t, delta)
    return
  }
  const takes = new Set(
    targetGroupIds()
      .map((id) => groupLive(id).content)
      .filter((c) => c?.type === 'slides')
      .map((c) => c!.take)
  )
  for (const t of takes) stepTake(t, delta)
}

/** Show one page. If the slides are not live in the target, they go live at that page. */
export function showPage(itemId: string, page: number): void {
  const item = findItem(itemId)
  if (!item) return
  const ids = targetGroupIds().filter((id) => groupLive(id).content?.itemId === itemId)
  if (ids.length === 0) return goLive(itemId, undefined, page)
  for (const id of ids) live.get(id)!.content!.page = clampPage(item, page)
  changed({ save: false })
}

function groupsWithTake(t: number): string[] {
  return [...live].filter(([, g]) => g.content?.take === t).map(([id]) => id)
}

function groupsWithTextTake(t: number): string[] {
  return [...live].filter(([, g]) => g.text?.take === t).map(([id]) => id)
}

/** The groups that show this take go to the item after it (or to idle after the last item). */
function advanceFrom(t: number): void {
  let groupIds = groupsWithTake(t)
  let itemId = groupIds.length ? live.get(groupIds[0])!.content!.itemId : null
  if (!itemId) {
    groupIds = groupsWithTextTake(t)
    itemId = groupIds.length ? live.get(groupIds[0])!.text!.itemId : null
  }
  if (!itemId) return
  const items = service.items
  const from = orderIndex(itemId)
  const nextItem = items.slice(from + 1).find(isReady)
  if (nextItem) goLiveIn(groupIds, nextItem.id)
  else clearGroups(groupIds, true, 'both')
}

export function next(): void {
  const i = nextIndex()
  if (i >= 0) goLive(service.items[i].id)
  else clearGroups(targetGroupIds(), true, 'both') // The last item ended: go to idle.
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

/** Remove a layer in these groups. With nothing left, a group shows its idle screen. */
function clearGroups(groupIds: string[], markDone: boolean, layer: 'content' | 'text' | 'both' = 'content'): void {
  const before = liveItemIds()
  let any = false
  for (const id of groupIds) {
    const g = live.get(id)
    if (!g) continue
    const content = layer === 'text' ? g.content : null
    const text = layer === 'content' ? g.text : null
    if (content !== g.content || text !== g.text) {
      live.set(id, { content, text })
      any = true
    }
  }
  if (!any) return
  updateStatuses(before, markDone)
  changed()
}

/** Esc: clear the target (content and text), or the content of one group. */
export function clear(groupId?: string): void {
  if (groupId) clearGroups([groupId], true, 'content')
  else clearGroups(targetGroupIds(), true, 'both')
}

/** "Clear text": the target, one group, or all groups. */
export function clearText(groupId?: string): void {
  const ids = groupId === 'all' ? getGroups().map((g) => g.id) : groupId ? [groupId] : targetGroupIds()
  clearGroups(ids, true, 'text')
}

// ---- Bible text ----

/** Put text screens (Bible, song) on the text layer of these groups. Full screen also removes the content. */
function showText(
  groupIds: string[],
  itemId: string | null,
  screens: BibleScreen[],
  settings: ItemSettings,
  title: string,
  ref?: BibleRef,
  startVerse?: number
): void {
  if (screens.length === 0 || groupIds.length === 0) return
  const before = liveItemIds()
  const t = ++take
  const index = startVerse ? Math.max(0, screens.findIndex((s) => s.verse >= startVerse)) : 0
  const text: TextLayer = { itemId, take: t, title, ref, screens, index, settings }
  for (const id of groupIds) {
    const g = groupLive(id)
    live.set(id, { content: settings.mode === 'lower' ? g.content : null, text: { ...text } })
  }
  if (ref) remember(ref)
  updateStatuses(before, true)
  changed()
}

/** Keep the passage in the "Today" list of this service (newest first, no doubles). */
function remember(ref: BibleRef): void {
  const label = refLabel(ref)
  service.bibleHistory = [ref, ...(service.bibleHistory ?? []).filter((r) => refLabel(r) !== label)].slice(0, 12)
}

function stepText(t: number, delta: number): void {
  const groupIds = groupsWithTextTake(t)
  const text = groupIds.length ? live.get(groupIds[0])!.text! : null
  if (!text) return
  const index = text.index + delta
  // After the last screen, Bible items from the order go to the next item.
  if (index >= text.screens.length) {
    if (text.itemId) advanceFrom(t)
    return
  }
  for (const id of groupIds) live.get(id)!.text!.index = Math.max(0, index)
  changed({ save: false })
}

export function addBibleToOrder(ref: BibleRef): void {
  service.items.push({
    id: randomUUID(),
    type: 'bible',
    title: refLabel(ref),
    path: '',
    cache: 'ready',
    status: 'pending',
    bible: ref,
    settings: bibleDefaults()
  })
  changed()
}

/** "Show now" in the Bible panel: live on the target, not added to the order. */
export function showBibleNow(ref: BibleRef, startVerse?: number): void {
  const settings = bibleDefaults()
  showText(targetGroupIds(), null, buildScreens(ref, settings), settings, refLabel(ref), ref, startVerse)
}

/** One screen per stanza. */
function songScreens(item: ServiceItem): BibleScreen[] {
  const list = item.stanzas ?? []
  return list.map((text, i) => ({ text, ref: item.title, label: `${i + 1}/${list.length}`, verse: i + 1 }))
}

/** Show the screen of one verse in the Bible text that is live in the target. */
export function showVerse(verse: number): void {
  let any = false
  for (const id of targetGroupIds()) {
    const text = groupLive(id).text
    if (!text) continue
    const index = text.screens.findIndex((s) => s.verse >= verse)
    if (index >= 0) text.index = index
    any = true
  }
  if (any) changed({ save: false })
}

export function bibleScreens(ref: BibleRef, settings: Partial<ItemSettings>): BibleScreen[] {
  return buildScreens(ref, { ...bibleDefaults(), ...settings })
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
