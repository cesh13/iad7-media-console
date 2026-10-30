import { existsSync } from 'node:fs'
import { extname } from 'node:path'
import type { GroupConfig, MediaRef, Settings } from '../shared/types'
import { cacheFile, mediaUrl } from './cache'
import { typeByExtension } from './fileTypes'
import { newGroup, saveSettings } from './settings'

// Group settings (screens per group, idle screen) and the church logo.

let settings: Settings
let notify: () => void = () => {}

export function connectGroups(s: Settings, onChange: () => void): void {
  settings = s
  notify = onChange
  // Make sure the cached copies of idle files and the logo still exist.
  for (const g of settings.groups) for (const m of g.idleMedia) ensureCached(m)
  if (settings.logo) ensureCached(settings.logo)
}

function changed(): void {
  saveSettings(settings)
  notify()
}

/** Make sure the cached copy of a saved file (a text background) still exists. */
export function refreshMedia(m: MediaRef): void {
  ensureCached(m)
}

function ensureCached(m: MediaRef): void {
  if (m.cachedPath && existsSync(m.cachedPath)) {
    m.url = mediaUrl(m.cachedPath)
    return
  }
  m.url = undefined
  cacheFile(m.path, () => {})
    .then((cached) => {
      m.cachedPath = cached
      m.url = mediaUrl(cached)
      changed()
    })
    .catch((err) => console.error('Could not copy', m.path, err))
}

export function mediaRef(path: string): MediaRef | null {
  const type = typeByExtension[extname(path).toLowerCase()]
  // Idle screens and the logo use pictures and videos; the playlist uses audio.
  if (type !== 'image' && type !== 'video' && type !== 'audio') return null
  const ref: MediaRef = { path, type }
  ensureCached(ref)
  return ref
}

function group(groupId: string): GroupConfig | undefined {
  return settings.groups.find((g) => g.id === groupId)
}

export function addGroup(name: string): void {
  settings.groups.push(newGroup(name.trim() || `Group ${settings.groups.length + 1}`))
  changed()
}

export function removeGroup(groupId: string): void {
  settings.groups = settings.groups.filter((g) => g.id !== groupId)
  changed()
}

export function updateGroup(groupId: string, change: Partial<Pick<GroupConfig, 'name' | 'idle' | 'idleInterval' | 'stageView' | 'showProgram'>>): void {
  const g = group(groupId)
  if (!g) return
  if (change.name !== undefined && change.name.trim()) g.name = change.name.trim()
  if (change.idle !== undefined) g.idle = change.idle
  if (change.idleInterval !== undefined && change.idleInterval >= 1) g.idleInterval = change.idleInterval
  if (change.stageView !== undefined) g.stageView = change.stageView
  if (change.showProgram !== undefined) g.showProgram = change.showProgram
  changed()
}

/** An output is in one group at most. Two screens in one group show the same content. */
export function assignOutput(outputId: string, groupId: string | null): void {
  for (const g of settings.groups) g.outputIds = g.outputIds.filter((id) => id !== outputId)
  const g = groupId ? group(groupId) : undefined
  if (g) g.outputIds.push(outputId)
  changed()
}

/** A new output goes into the first group if no group has a screen yet. */
export function placeNewOutput(outputId: string): void {
  if (settings.groups.some((g) => g.outputIds.includes(outputId))) return
  if (settings.groups.every((g) => g.outputIds.length === 0) && settings.groups[0]) {
    settings.groups[0].outputIds.push(outputId)
  }
}

export function forgetOutput(outputId: string): void {
  for (const g of settings.groups) g.outputIds = g.outputIds.filter((id) => id !== outputId)
}

export function setIdleMedia(groupId: string, paths: string[]): void {
  const g = group(groupId)
  if (!g) return
  g.idleMedia = paths.map(mediaRef).filter((m): m is MediaRef => m !== null)
  // Choosing files means the team wants to see them.
  if (g.idle === 'black' || g.idle === 'logo') g.idle = g.idleMedia.length > 1 ? 'loop' : 'background'
  changed()
}

export function setLogo(path: string): void {
  const ref = mediaRef(path)
  if (ref?.type === 'image') {
    settings.logo = ref
    changed()
  }
}
