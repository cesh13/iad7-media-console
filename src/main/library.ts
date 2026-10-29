import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { normalize } from '../shared/bibleBooks'
import type { Favorite, LibEntry, LibraryFolder, Settings } from '../shared/types'
import { byFileName, itemType } from './fileTypes'
import { saveSettings } from './settings'

/**
 * The Library tab (SPEC 5.2): root folders, browsing, search, and when each
 * file was last used. Favorites ("★ Favorites") and hotkeys F1–F8 (SPEC 5.6).
 */

let settings: Settings
let notify: () => void = () => {}
/** How often and when each file went live (by path, lower case). */
let usage: Record<string, { count: number; last: number }> = {}
let usageTimer: NodeJS.Timeout | null = null

const usageFile = () => join(app.getPath('userData'), 'usage.json')

export function connectLibrary(s: Settings, onChange: () => void): void {
  settings = s
  notify = onChange
  try {
    if (existsSync(usageFile())) usage = JSON.parse(readFileSync(usageFile(), 'utf8'))
  } catch {
    usage = {}
  }
  // First run: Logo on F1 and "Black screen" on F8, as in the mockup.
  if (!settings.favorites) {
    settings.favorites = [
      { id: randomUUID(), kind: 'logo', title: 'Logo', hotkey: 1 },
      { id: randomUUID(), kind: 'countdown', title: 'Countdown 5 min', seconds: 300, hotkey: 4 },
      { id: randomUUID(), kind: 'black', title: 'Black screen', hotkey: 8 }
    ]
    saveSettings(settings)
  }
}

function changed(): void {
  saveSettings(settings)
  notify()
}

export function libraryFolders(): LibraryFolder[] {
  return settings.library ?? []
}

export function favorites(): Favorite[] {
  return settings.favorites ?? []
}

export function addLibraryFolder(path: string): void {
  if (libraryFolders().some((f) => f.path === path)) return
  settings.library = [...libraryFolders(), { path, name: basename(path) || path }]
  changed()
}

export function removeLibraryFolder(path: string): void {
  settings.library = libraryFolders().filter((f) => f.path !== path)
  changed()
}

// ---- Usage ----

/** Call when a file goes live. */
export function markUsed(path: string): void {
  const k = path.toLowerCase()
  const u = usage[k] ?? { count: 0, last: 0 }
  usage[k] = { count: u.count + 1, last: Date.now() }
  if (usageTimer) clearTimeout(usageTimer)
  usageTimer = setTimeout(() => writeFileSync(usageFile(), JSON.stringify(usage), 'utf8'), 2000)
}

// ---- Browsing ----

async function entry(path: string, name: string, dir: boolean): Promise<LibEntry | null> {
  const info = await stat(path).catch(() => null)
  if (!info) return null
  const e: LibEntry = { name, path, dir, type: dir ? null : itemType(path), size: info.size, mtime: info.mtimeMs, used: usage[path.toLowerCase()] }
  if (dir) e.files = (await readdir(path).catch(() => [])).filter((n) => itemType(n)).length
  return e
}

/** Folders and the files the app can show, folders first, in file-name order. */
export async function listLibrary(path: string): Promise<LibEntry[]> {
  const dirents = await readdir(path, { withFileTypes: true }).catch(() => [])
  const list = await Promise.all(
    dirents
      .filter((d) => d.isDirectory() ? !d.name.startsWith('.') : !!itemType(d.name))
      .map((d) => entry(join(path, d.name), d.name, d.isDirectory()))
  )
  return list
    .filter((e): e is LibEntry => !!e)
    .sort((a, b) => (a.dir === b.dir ? byFileName(a.name, b.name) : a.dir ? -1 : 1))
}

/** Files whose name has all the words (no accents, any case), up to 3 folders deep. */
export async function searchLibrary(path: string, query: string): Promise<LibEntry[]> {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return listLibrary(path)
  const found: LibEntry[] = []
  const walk = async (dir: string, depth: number) => {
    const dirents = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const d of dirents) {
      const p = join(dir, d.name)
      if (d.isDirectory()) {
        if (depth < 3 && !d.name.startsWith('.')) await walk(p, depth + 1)
      } else if (itemType(d.name) && words.every((w) => normalize(d.name).includes(w))) {
        const e = await entry(p, d.name, false)
        if (e) found.push(e)
        if (found.length >= 300) return
      }
    }
  }
  await walk(path, 0)
  return found.sort((a, b) => byFileName(a.name, b.name))
}

// ---- Favorites and hotkeys ----

export function addFavorite(path: string): void {
  if (favorites().some((f) => f.path === path)) return
  const type = itemType(path)
  if (!type || type === 'folder') return
  settings.favorites = [...favorites(), { id: randomUUID(), kind: 'file', title: basename(path), path, type }]
  changed()
}

export function addFavoriteAction(kind: 'logo' | 'black' | 'countdown'): void {
  const title = kind === 'logo' ? 'Logo' : kind === 'black' ? 'Black screen' : 'Countdown 5 min'
  settings.favorites = [...favorites(), { id: randomUUID(), kind, title, seconds: kind === 'countdown' ? 300 : undefined }]
  changed()
}

export function removeFavorite(id: string): void {
  settings.favorites = favorites().filter((f) => f.id !== id)
  changed()
}

/** One hotkey belongs to one favorite: giving it to another takes it away from the first. */
export function setHotkey(id: string, key: number | null): void {
  settings.favorites = favorites().map((f) => {
    if (f.id === id) return { ...f, hotkey: key ?? undefined }
    if (key !== null && f.hotkey === key) return { ...f, hotkey: undefined }
    return f
  })
  changed()
}

export function favoriteForKey(key: number): Favorite | undefined {
  return favorites().find((f) => f.hotkey === key)
}
