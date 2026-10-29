import { basename, extname } from 'node:path'
import type { ItemType } from '../shared/types'

/** Item type by file extension. */
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
  '.bmp': 'image',
  '.pdf': 'slides',
  '.pptx': 'slides',
  '.ppt': 'slides',
  '.ppsx': 'slides',
  '.pps': 'slides',
  '.odp': 'slides',
  // A text file is a song: one stanza per screen.
  '.txt': 'song'
}

const ignoredNames = new Set(['thumbs.db', 'desktop.ini', '.ds_store'])

/** The item type of a file, or null for files the app does not show (and system files). */
export function itemType(path: string): ItemType | null {
  const name = basename(path).toLowerCase()
  if (ignoredNames.has(name) || name.startsWith('~$') || name.startsWith('.')) return null
  return typeByExtension[extname(name)] ?? null
}

/** Sort by file name the way people expect: "2" before "10". */
export function byFileName(a: string, b: string): number {
  return basename(a).localeCompare(basename(b), undefined, { numeric: true, sensitivity: 'base' })
}
