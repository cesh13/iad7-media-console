import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bookName, normalize, parseReference } from '../shared/bibleBooks'
import type { BibleHit, BibleRef, BibleScreen, BibleSearchResult, BibleVersion, ItemSettings } from '../shared/types'
import { readBibleFile, type BibleData } from './bibleImport'

// Imported Bible versions: stored as JSON in the user data folder. The full
// text is loaded only when it is needed, and kept in memory after that.

interface Stored extends BibleData {
  id: string
}

const loaded = new Map<string, Stored>()
/** Text without accents, for the word search, by version. */
const searchIndex = new Map<string, { b: number; c: number; v: number; norm: string }[]>()
let versions: BibleVersion[] | null = null

function dir(): string {
  const d = join(app.getPath('userData'), 'bibles')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

const indexFile = () => join(dir(), 'index.json')

export function listBibles(): BibleVersion[] {
  if (!versions) {
    try {
      versions = existsSync(indexFile()) ? (JSON.parse(readFileSync(indexFile(), 'utf8')) as BibleVersion[]) : []
    } catch {
      versions = []
    }
  }
  return versions
}

function saveIndex(): void {
  writeFileSync(indexFile(), JSON.stringify(listBibles()), 'utf8')
}

/** Import a Bible file. A download gives its own id, name and short name. */
export async function importBible(path: string, given?: { id: string; name: string; abbrev: string }): Promise<BibleVersion> {
  const read = await readBibleFile(path)
  const data = given ? { ...read, name: given.name, abbrev: given.abbrev } : read
  const id =
    given?.id ?? `${data.abbrev.replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'bible'}-${createHash('sha1').update(path).digest('hex').slice(0, 6)}`
  writeFileSync(join(dir(), `${id}.json`), JSON.stringify({ ...data, id }), 'utf8')
  const version: BibleVersion = {
    id,
    name: data.name,
    abbrev: data.abbrev,
    verseCounts: Array.from({ length: 66 }, (_, b) => (data.books[b] ?? []).map((ch) => ch?.length ?? 0))
  }
  versions = [...listBibles().filter((v) => v.id !== id), version]
  saveIndex()
  loaded.delete(id)
  searchIndex.delete(id)
  return version
}

export function removeBible(id: string): void {
  versions = listBibles().filter((v) => v.id !== id)
  saveIndex()
  rmSync(join(dir(), `${id}.json`), { force: true })
  loaded.delete(id)
  searchIndex.delete(id)
}

function bible(id: string): Stored | null {
  if (loaded.has(id)) return loaded.get(id)!
  const file = join(dir(), `${id}.json`)
  if (!existsSync(file)) return null
  const data = JSON.parse(readFileSync(file, 'utf8')) as Stored
  loaded.set(id, data)
  return data
}

export function getChapter(id: string, book: number, chapter: number): string[] {
  return bible(id)?.books[book - 1]?.[chapter - 1] ?? []
}

function version(id: string): BibleVersion | undefined {
  return listBibles().find((v) => v.id === id)
}

/** A reference ("sal 23:1-4") or words ("buen pastor"). Words ignore accents and case. */
export function search(id: string, query: string): BibleSearchResult {
  const v = version(id)
  if (!v || !query.trim()) return { kind: 'none' }
  const ref = parseReference(query, (book) => v.verseCounts[book - 1]?.length ?? 0)
  if (ref) return { kind: 'ref', ...ref }

  const words = normalize(query).split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) return { kind: 'none' }
  const data = bible(id)
  if (!data) return { kind: 'none' }
  if (!searchIndex.has(id)) {
    const list: { b: number; c: number; v: number; norm: string }[] = []
    data.books.forEach((chapters, b) =>
      chapters?.forEach((verses, c) => verses?.forEach((text, vi) => text && list.push({ b: b + 1, c: c + 1, v: vi + 1, norm: normalize(text) })))
    )
    searchIndex.set(id, list)
  }
  const limit = 100
  const hits: BibleHit[] = []
  let more = false
  for (const e of searchIndex.get(id)!) {
    if (!words.every((w) => e.norm.includes(w))) continue
    if (hits.length === limit) {
      more = true
      break
    }
    hits.push({ book: e.b, chapter: e.c, verse: e.v, text: data.books[e.b - 1][e.c - 1][e.v - 1] })
  }
  return { kind: 'words', hits, more }
}

// ---- Screens ----

export function bibleDefaults(): ItemSettings {
  return {
    autoDone: true,
    versesPerScreen: 1,
    splitLong: true,
    refPosition: 'below',
    showVersion: true,
    mode: 'full',
    secondBibleId: null
  }
}

const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).split('').map((d) => superscripts[Number(d)]).join('')

/** Split a long text into `parts` pieces of about the same length, at a space, best after punctuation. */
function splitText(text: string, parts: number): string[] {
  const out: string[] = []
  let rest = text
  for (let left = parts; left > 1; left--) {
    const target = rest.length / left
    let best = -1
    let bestScore = Infinity
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] !== ' ') continue
      const afterPunct = /[;,:.]/.test(rest[i - 1] ?? '')
      const score = Math.abs(i - target) - (afterPunct ? target * 0.25 : 0)
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) break
    out.push(rest.slice(0, best).trim())
    rest = rest.slice(best + 1)
  }
  out.push(rest.trim())
  return out
}

/** The screens of a passage (SPEC 6): verses per screen, long verses split with "…". */
export function buildScreens(ref: BibleRef, s: ItemSettings): BibleScreen[] {
  const v = version(ref.bibleId)
  const verses = getChapter(ref.bibleId, ref.book, ref.chapter)
  const second = s.secondBibleId ? getChapter(s.secondBibleId, ref.book, ref.chapter) : null
  const secondAbbrev = s.secondBibleId ? version(s.secondBibleId)?.abbrev : undefined
  const maxChars = (s.mode === 'lower' ? 160 : 320) * (second ? 0.6 : 1)
  const list: { n: number; text: string }[] = []
  for (let n = ref.from; n <= ref.to; n++) if (verses[n - 1]) list.push({ n, text: verses[n - 1] })

  // Group the verses: a fixed number per screen, or as many as fit (0).
  const groups: { n: number; text: string }[][] = []
  for (const verse of list) {
    const last = groups[groups.length - 1]
    const perScreen = s.versesPerScreen ?? 1
    const fits = last && (perScreen === 0
      ? [...last, verse].reduce((sum, x) => sum + x.text.length + 4, 0) <= maxChars
      : last.length < perScreen)
    if (fits) last.push(verse)
    else groups.push([verse])
  }

  const screens: BibleScreen[] = []
  for (const g of groups) {
    const first = g[0].n
    const lastN = g[g.length - 1].n
    const range = first === lastN ? `${first}` : `${first}-${lastN}`
    const refText = `${bookName(ref.book)} ${ref.chapter}:${range}${s.showVersion !== false && v ? ` · ${v.abbrev}` : ''}`
    const secondText = second
      ? g.map((x) => second[x.n - 1]).filter(Boolean).join(' ') + (secondAbbrev && s.showVersion !== false ? ` (${secondAbbrev})` : '')
      : undefined
    const text = g.length === 1 ? g[0].text : g.map((x) => `${sup(x.n)} ${x.text}`).join(' ')

    const parts = g.length === 1 && s.splitLong !== false && text.length > maxChars ? splitText(text, Math.ceil(text.length / maxChars)) : [text]
    parts.forEach((part, i) => {
      const of = parts.length > 1 ? ` (${i + 1}/${parts.length})` : ''
      screens.push({
        text: i < parts.length - 1 ? `${part}…` : part,
        second: i === 0 ? secondText : undefined,
        ref: `${refText}${of}`,
        label: `${ref.chapter}:${range}${of}`,
        verse: first
      })
    })
  }
  return screens
}
