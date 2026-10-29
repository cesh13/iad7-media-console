import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { findBook, normalize } from '../shared/bibleBooks'

/**
 * Read a Bible file into one simple format. Supported:
 * - Zefania XML (common for free Bibles, for example RV1909)
 * - OSIS XML
 * - JSON: a list of 66 books with chapters, or a list of verses
 *   ({ book, chapter, verse, text }), or the scrollmapper "resultset" format
 * - Text, CSV or TSV: "book, chapter, verse, text" per line, or "Génesis 1:1 text"
 * Use only public-domain versions, or versions the church has a license for.
 */

export interface BibleData {
  name: string
  abbrev: string
  /** books[book - 1][chapter - 1][verse - 1] = text */
  books: string[][][]
}

const osisCodes = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr',
  'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel',
  'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John',
  'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm',
  'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev'
]

/** English book names, as many Bible files use them. */
const englishNames = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
  'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
]
const englishKeys = new Map(englishNames.map((n, i) => [normalize(n).replace(/[\s.]/g, ''), i + 1]))
const osisKeys = new Map(osisCodes.map((c, i) => [c.toLowerCase(), i + 1]))

/** Book number from a number, an OSIS code, a Spanish name or an English name. */
function bookNumber(value: unknown): number | null {
  if (typeof value === 'number') return value >= 1 && value <= 66 ? value : null
  const text = String(value ?? '').trim()
  if (/^\d+$/.test(text)) return bookNumber(Number(text))
  const k = normalize(text).replace(/[\s.]/g, '')
  return osisKeys.get(k) ?? englishKeys.get(k) ?? findBook(text)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Verse text without notes and tags. */
function cleanText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<(note|NOTE|rf|RF)\b[\s\S]*?<\/\1>/g, '')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function attr(attrs: string, name: string): string | null {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attrs)?.[1] ?? null
}

class Builder {
  books: string[][][] = []
  count = 0
  add(book: number | null, chapter: number, verse: number, text: string): void {
    if (!book || book < 1 || book > 66 || chapter < 1 || verse < 1 || !text) return
    const b = (this.books[book - 1] ??= [])
    const c = (b[chapter - 1] ??= [])
    c[verse - 1] = text
    this.count++
  }
}

function parseZefania(xml: string, out: Builder): void {
  for (const book of xml.matchAll(/<BIBLEBOOK\b([^>]*)>([\s\S]*?)<\/BIBLEBOOK>/gi)) {
    const b = bookNumber(attr(book[1], 'bnumber')) ?? bookNumber(attr(book[1], 'bname'))
    for (const ch of book[2].matchAll(/<CHAPTER\b([^>]*)>([\s\S]*?)<\/CHAPTER>/gi)) {
      const c = Number(attr(ch[1], 'cnumber'))
      for (const v of ch[2].matchAll(/<VERS\b([^>]*)>([\s\S]*?)<\/VERS>/gi)) {
        out.add(b, c, Number(attr(v[1], 'vnumber')), cleanText(v[2]))
      }
    }
  }
}

function addOsisId(id: string, text: string, out: Builder): void {
  // "Gen.1.1", or several ids "Gen.1.1 Gen.1.2" for joined verses (use the first).
  const [code, c, v] = id.split(/\s+/)[0].split('.')
  out.add(bookNumber(code), Number(c), Number(v), cleanText(text))
}

function parseOsis(xml: string, out: Builder): void {
  // Verses with their text inside: <verse osisID="Gen.1.1">…</verse>
  for (const m of xml.matchAll(/<verse\b([^>]*[^/])>([\s\S]*?)<\/verse>/g)) {
    const id = attr(m[1], 'osisID')
    if (id) addOsisId(id, m[2], out)
  }
  if (out.count) return
  // Milestones: <verse sID="…" osisID="Gen.1.1"/> text <verse eID="…"/>
  const starts = [...xml.matchAll(/<verse\b([^>]*\bsID\s*=[^>]*)\/>/g)]
  for (const m of starts) {
    const id = attr(m[1], 'osisID')
    const from = m.index! + m[0].length
    const end = xml.slice(from).search(/<verse\b[^>]*\beID\s*=/)
    if (id && end >= 0) addOsisId(id, xml.slice(from, from + end), out)
  }
}

function parseJson(text: string, out: Builder): void {
  const data = JSON.parse(text.replace(/^﻿/, ''))
  const verseList = (list: unknown[]) => {
    for (const r of list as Record<string, unknown>[]) {
      if (Array.isArray(r)) continue
      const book = r.book ?? r.book_name ?? r.b ?? r.bookName ?? r.book_id
      out.add(bookNumber(book), Number(r.chapter ?? r.c), Number(r.verse ?? r.v), String(r.text ?? r.t ?? '').trim())
    }
  }
  // scrollmapper: { resultset: { row: [{ field: [id, book, chapter, verse, text] }] } }
  const rows = data?.resultset?.row
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const [, b, c, v, t] = r.field ?? []
      out.add(bookNumber(b), Number(c), Number(v), String(t ?? '').trim())
    }
    return
  }
  const list = Array.isArray(data) ? data : (data?.books ?? data?.verses)
  if (!Array.isArray(list)) throw new Error('Unknown JSON format')
  // A list of books: [{ chapters: [["v1", "v2"], …] }] or [{ chapters: [{ verses: [{ verse, text }] }] }]
  if (list.length && list[0] && typeof list[0] === 'object' && 'chapters' in list[0]) {
    list.forEach((book: Record<string, unknown>, i: number) => {
      const b = bookNumber(book.nr ?? book.number ?? book.name ?? book.abbrev) ?? i + 1
      ;(book.chapters as unknown[]).forEach((ch, ci) => {
        const verses = Array.isArray(ch) ? ch : ((ch as Record<string, unknown>).verses as unknown[])
        const cNum = Array.isArray(ch) ? ci + 1 : Number((ch as Record<string, unknown>).chapter ?? ci + 1)
        verses?.forEach((v, vi) => {
          if (typeof v === 'string') out.add(b, cNum, vi + 1, v.trim())
          else {
            const r = v as Record<string, unknown>
            out.add(b, cNum, Number(r.verse ?? vi + 1), String(r.text ?? '').trim())
          }
        })
      })
    })
    return
  }
  verseList(list)
}

function parseText(text: string, out: Builder): void {
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    // "Génesis 1:1 En el principio…"
    const ref = /^(.+?)\s+(\d+):(\d+)\s+(.+)$/.exec(line)
    if (ref && !line.includes('\t')) {
      out.add(bookNumber(ref[1]), Number(ref[2]), Number(ref[3]), ref[4].trim())
      continue
    }
    // book, chapter, verse, text (tab, "|", ";" or "," between the columns)
    const sep = ['\t', '|', ';', ','].find((s) => line.split(s).length >= 4)
    if (!sep) continue
    const [b, c, v, ...rest] = line.split(sep)
    out.add(bookNumber(b), Number(c), Number(v), rest.join(sep).replace(/^"|"$/g, '').trim())
  }
}

export async function readBibleFile(path: string): Promise<BibleData> {
  const raw = await readFile(path, 'utf8')
  const out = new Builder()
  const ext = extname(path).toLowerCase()
  let name = basename(path, extname(path))
  let abbrev = ''

  if (/<XMLBIBLE\b/i.test(raw)) {
    parseZefania(raw, out)
    name = cleanText(/<title>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? '') || name
    abbrev = cleanText(/<identifier>([\s\S]*?)<\/identifier>/i.exec(raw)?.[1] ?? '')
  } else if (/<osis\b/i.test(raw)) {
    parseOsis(raw, out)
    name = cleanText(/<title>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? '') || name
    abbrev = attr(/<osisText\b([^>]*)>/i.exec(raw)?.[1] ?? '', 'osisIDWork') ?? ''
  } else if (ext === '.json' || /^\s*[[{]/.test(raw)) {
    parseJson(raw, out)
  } else {
    parseText(raw, out)
  }

  if (out.count === 0) throw new Error('No verses found. Use Zefania XML, OSIS XML, JSON or a text file with book, chapter, verse, text.')
  // Short name for the version selector: the identifier, a short file name, or the first letters.
  if (!abbrev) abbrev = name.length <= 12 ? name : name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)
  return { name, abbrev, books: out.books }
}
