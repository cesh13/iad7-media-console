import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import type { HymnAudio, HymnChoice, HymnInfo, HymnalState, Settings } from '../shared/types'
import { byFileName, typeByExtension } from './fileTypes'
import { saveSettings } from './settings'

/**
 * The hymnal: a folder with the pictures and the music of each hymn. The team
 * copies the files into the folder; the app only reads them. The files are
 * played from the folder itself (no copy in the media cache), because the
 * folder is on this computer and is large (about 3.8 GB).
 *
 *   Letra/001 - Cantad alegres al Senor/01.jpg, 02.jpg, …   one picture per slide
 *   Musica/Cantado/001 - Cantad alegres al Senor.mp3        sung
 *   Musica/Instrumental/001 - Cantad alegres al Senor.mp3   track only
 *   himnos.json                                             optional: titles and slide times
 *
 * A hymn is found by the number at the start of the name, so the names of the
 * music files do not need to be the same as the names of the picture folders.
 */

let settings: Settings
let state: HymnalState = { root: '', found: false, hymns: [] }
let byNumber = new Map<number, HymnInfo>()
let notify: () => void = () => {}

const musicFolders: Record<Exclude<HymnAudio, 'none'>, string> = { sung: 'Cantado', instrumental: 'Instrumental' }

/** The folder the app reads: the chosen folder, or the default one. */
export function hymnalRoot(): string {
  if (settings?.hymnalFolder) return settings.hymnalFolder
  // The dev copy uses the "himnario" folder of the project. The installed app uses Documents\Himnario.
  return app.isPackaged ? join(app.getPath('documents'), 'Himnario') : join(app.getAppPath(), 'himnario')
}

export function connectHymnal(s: Settings, onChange: () => void): void {
  settings = s
  notify = onChange
  scan()
}

export function hymnalState(): HymnalState {
  return state
}

export function findHymn(number: number): HymnInfo | undefined {
  return byNumber.get(number)
}

/** Read the folder again and tell the windows. */
export function rescanHymnal(): void {
  scan()
  notify()
}

export function setHymnalFolder(path: string): void {
  settings.hymnalFolder = path
  saveSettings(settings)
  rescanHymnal()
}

/** Make the folder (with its subfolders) if it is missing, so the team can copy the files into it. */
export function ensureHymnalFolder(): string {
  const root = hymnalRoot()
  for (const dir of ['Letra', join('Musica', 'Cantado'), join('Musica', 'Instrumental')]) {
    mkdirSync(join(root, dir), { recursive: true })
  }
  return root
}

/** media://hymnal/<path inside the hymnal folder>. See protocol.ts. */
function hymnalUrl(...parts: string[]): string {
  return `media://hymnal/${parts.map(encodeURIComponent).join('/')}`
}

/** The music of a hymn item as a media:// URL, or null (no music, or the file is missing). */
export function hymnAudioUrl(choice: HymnChoice): string | null {
  if (choice.audio === 'none') return null
  const files = byNumber.get(choice.number)?.[choice.audio] ?? []
  const file = files[choice.track ?? 0] ?? files[0]
  return file ? hymnalUrl('Musica', musicFolders[choice.audio], file) : null
}

/**
 * The file for a path in the hymnal folder ("/Letra/001 - …/01.jpg"), or null.
 * Only files inside the hymnal folder: no "..", no other folders.
 */
export function hymnalFile(pathname: string): string | null {
  const root = hymnalRoot()
  let file: string
  try {
    file = resolve(root, ...pathname.split('/').filter(Boolean).map(decodeURIComponent))
  } catch {
    return null // A bad %-escape in the path.
  }
  const inside = relative(root, file)
  if (!inside || inside.startsWith('..') || !existsSync(file) || !statSync(file).isFile()) return null
  return file
}

/** The number at the start of a name: "045 - Santo.mp3" → 45. */
function leadingNumber(name: string): number | null {
  const m = /^\s*(\d+)/.exec(name)
  return m ? Number(m[1]) : null
}

function filesOfType(dir: string, type: 'image' | 'audio'): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => !n.startsWith('.') && typeByExtension[extname(n).toLowerCase()] === type)
    .sort(byFileName)
}

/** Titles (with accents) and slide times from himnos.json, when the folder has it. */
function readMeta(root: string): Map<number, { title?: string; times?: number[] }> {
  const meta = new Map<number, { title?: string; times?: number[] }>()
  try {
    const data = JSON.parse(readFileSync(join(root, 'himnos.json'), 'utf8')) as {
      hymns?: { number: number; title?: string; times?: number[] }[]
    }
    for (const h of data.hymns ?? []) if (Number.isFinite(h.number)) meta.set(h.number, h)
  } catch {
    // No file, or a broken file: titles come from the folder names.
  }
  return meta
}

/** Music files by hymn number. */
function readMusic(dir: string): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const file of filesOfType(dir, 'audio')) {
    const n = leadingNumber(file)
    if (n === null) continue
    map.set(n, [...(map.get(n) ?? []), file])
  }
  // "614 - Amenes" comes before "614 -  Amenes B": compare the names without the extension and extra spaces.
  const key = (file: string): string => file.replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim()
  for (const files of map.values()) files.sort((a, b) => key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: 'base' }))
  return map
}

function scan(): void {
  const root = hymnalRoot()
  const letra = join(root, 'Letra')
  const hymns: HymnInfo[] = []
  try {
    if (existsSync(letra)) {
      const meta = readMeta(root)
      const sung = readMusic(join(root, 'Musica', musicFolders.sung))
      const instrumental = readMusic(join(root, 'Musica', musicFolders.instrumental))
      for (const dir of readdirSync(letra, { withFileTypes: true })) {
        const number = dir.isDirectory() ? leadingNumber(dir.name) : null
        if (number === null) continue
        const pages = filesOfType(join(letra, dir.name), 'image')
        if (pages.length === 0) continue
        const info = meta.get(number)
        const nameTitle = dir.name.replace(/^\s*\d+\s*[-–.]?\s*/, '')
        const times = (info?.times ?? []).filter((t) => Number.isFinite(t) && t > 0)
        hymns.push({
          number,
          title: info?.title?.trim() || nameTitle || `Himno ${number}`,
          pageUrls: pages.map((p) => hymnalUrl('Letra', dir.name, p)),
          sung: sung.get(number) ?? [],
          instrumental: instrumental.get(number) ?? [],
          times
        })
      }
    }
  } catch (err) {
    console.error('Could not read the hymnal folder:', err)
  }
  hymns.sort((a, b) => a.number - b.number)
  state = { root, found: hymns.length > 0, hymns }
  byNumber = new Map(hymns.map((h) => [h.number, h]))
}
