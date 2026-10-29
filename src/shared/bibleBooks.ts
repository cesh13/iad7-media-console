// The 66 books of the Bible with Spanish names and short names, and the
// parser for references like "jn 3 16" or "sal 23:1-4" (SPEC 5.5).

export type BookCategory = 'ley' | 'his' | 'poe' | 'pro' | 'eva' | 'car'

export interface BookInfo {
  /** 1 = Génesis … 66 = Apocalipsis */
  n: number
  abbr: string
  name: string
  cat: BookCategory
  testament: 'ot' | 'nt'
}

/** Category names and colors from the design mockup. */
export const bookCategories: Record<BookCategory, { name: string; bg: string; fg: string }> = {
  ley: { name: 'Ley', bg: '#2E2A1C', fg: '#E2C98A' },
  his: { name: 'Historia', bg: '#1D2A22', fg: '#8FD1A8' },
  poe: { name: 'Poesía', bg: '#2A1F2E', fg: '#D2A6E0' },
  pro: { name: 'Profetas', bg: '#1C2633', fg: '#8EC1FF' },
  eva: { name: 'Evangelios', bg: '#33221C', fg: '#F0A988' },
  car: { name: 'Cartas y Apocalipsis', bg: '#22282E', fg: '#C3CDD7' }
}

const list: [string, string, BookCategory][] = [
  ['Gn', 'Génesis', 'ley'], ['Éx', 'Éxodo', 'ley'], ['Lv', 'Levítico', 'ley'], ['Nm', 'Números', 'ley'],
  ['Dt', 'Deuteronomio', 'ley'], ['Jos', 'Josué', 'his'], ['Jue', 'Jueces', 'his'], ['Rt', 'Rut', 'his'],
  ['1S', '1 Samuel', 'his'], ['2S', '2 Samuel', 'his'], ['1R', '1 Reyes', 'his'], ['2R', '2 Reyes', 'his'],
  ['1Cr', '1 Crónicas', 'his'], ['2Cr', '2 Crónicas', 'his'], ['Esd', 'Esdras', 'his'], ['Neh', 'Nehemías', 'his'],
  ['Est', 'Ester', 'his'], ['Job', 'Job', 'poe'], ['Sal', 'Salmos', 'poe'], ['Pr', 'Proverbios', 'poe'],
  ['Ec', 'Eclesiastés', 'poe'], ['Cnt', 'Cantares', 'poe'], ['Is', 'Isaías', 'pro'], ['Jer', 'Jeremías', 'pro'],
  ['Lm', 'Lamentaciones', 'pro'], ['Ez', 'Ezequiel', 'pro'], ['Dn', 'Daniel', 'pro'], ['Os', 'Oseas', 'pro'],
  ['Jl', 'Joel', 'pro'], ['Am', 'Amós', 'pro'], ['Abd', 'Abdías', 'pro'], ['Jon', 'Jonás', 'pro'],
  ['Mi', 'Miqueas', 'pro'], ['Nah', 'Nahúm', 'pro'], ['Hab', 'Habacuc', 'pro'], ['Sof', 'Sofonías', 'pro'],
  ['Hag', 'Hageo', 'pro'], ['Zac', 'Zacarías', 'pro'], ['Mal', 'Malaquías', 'pro'],
  ['Mt', 'Mateo', 'eva'], ['Mr', 'Marcos', 'eva'], ['Lc', 'Lucas', 'eva'], ['Jn', 'Juan', 'eva'],
  ['Hch', 'Hechos', 'his'], ['Ro', 'Romanos', 'car'], ['1Co', '1 Corintios', 'car'], ['2Co', '2 Corintios', 'car'],
  ['Gá', 'Gálatas', 'car'], ['Ef', 'Efesios', 'car'], ['Fil', 'Filipenses', 'car'], ['Col', 'Colosenses', 'car'],
  ['1Ts', '1 Tesalonicenses', 'car'], ['2Ts', '2 Tesalonicenses', 'car'], ['1Ti', '1 Timoteo', 'car'],
  ['2Ti', '2 Timoteo', 'car'], ['Tit', 'Tito', 'car'], ['Flm', 'Filemón', 'car'], ['He', 'Hebreos', 'car'],
  ['Stg', 'Santiago', 'car'], ['1P', '1 Pedro', 'car'], ['2P', '2 Pedro', 'car'], ['1Jn', '1 Juan', 'car'],
  ['2Jn', '2 Juan', 'car'], ['3Jn', '3 Juan', 'car'], ['Jud', 'Judas', 'car'], ['Ap', 'Apocalipsis', 'car']
]

export const books: BookInfo[] = list.map(([abbr, name, cat], i) => ({
  n: i + 1,
  abbr,
  name,
  cat,
  testament: i < 39 ? 'ot' : 'nt'
}))

/** Lower case, no accents, no dots or spaces. Used for book names and for search. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function key(text: string): string {
  return normalize(text).replace(/[\s.]/g, '')
}

/** Extra short names people type, also English ones found in Bible files. */
const extraAliases: Record<number, string[]> = {
  1: ['gen', 'ge', 'genesis'], 2: ['ex', 'exo', 'exodo'], 3: ['lev'], 4: ['num'], 5: ['deut', 'deu'],
  6: ['josh'], 7: ['jue', 'judg'], 8: ['rut', 'ruth'], 9: ['1sam', '1sa'], 10: ['2sam', '2sa'],
  11: ['1re', '1rey', '1kgs', '1ki'], 12: ['2re', '2rey', '2kgs', '2ki'], 13: ['1cro', '1chr', '1ch'],
  14: ['2cro', '2chr', '2ch'], 15: ['ezr', 'esd'], 16: ['neh'], 17: ['esth', 'est'], 18: ['job'],
  19: ['sal', 'sl', 'salmo', 'ps', 'psa', 'psalms'], 20: ['prov', 'pro', 'prv'], 21: ['ecl', 'eccl', 'qoh'],
  22: ['cant', 'can', 'song', 'cantar', 'cantardeloscantares'], 23: ['isa'], 24: ['jer'], 25: ['lam'],
  26: ['eze', 'ezek'], 27: ['dan'], 28: ['os', 'hos'], 29: ['joe', 'joel'], 30: ['amo'], 31: ['abd', 'obad', 'ob'],
  32: ['jon', 'jonah'], 33: ['miq', 'mic'], 34: ['nah'], 35: ['hab'], 36: ['sof', 'zeph'], 37: ['hag'],
  38: ['zac', 'zech'], 39: ['mal'], 40: ['mat', 'matt', 'mt'], 41: ['mar', 'mrk', 'mk', 'mc', 'mark'],
  42: ['luc', 'luk', 'lk'], 43: ['jn', 'jua', 'john', 'jhn'], 44: ['hch', 'hech', 'act', 'acts'],
  45: ['rom', 'ro'], 46: ['1cor', '1co'], 47: ['2cor', '2co'], 48: ['gal', 'ga'], 49: ['efe', 'eph'],
  50: ['flp', 'fil', 'phil', 'php'], 51: ['col'], 52: ['1tes', '1ts', '1thess', '1th'], 53: ['2tes', '2ts', '2thess', '2th'],
  54: ['1tim', '1ti'], 55: ['2tim', '2ti'], 56: ['tit', 'titus'], 57: ['flm', 'filem', 'phlm'],
  58: ['heb'], 59: ['stg', 'sant', 'jas', 'jam', 'santiago'], 60: ['1pe', '1ped', '1pet'], 61: ['2pe', '2ped', '2pet'],
  62: ['1jn', '1jua', '1john'], 63: ['2jn', '2jua', '2john'], 64: ['3jn', '3jua', '3john'], 65: ['jud', 'jude'],
  66: ['ap', 'apo', 'apoc', 'rev', 'revelation', 'apocalipsis']
}

const aliasMap = new Map<string, number>()
for (const b of books) {
  for (const a of [b.abbr, b.name, ...(extraAliases[b.n] ?? [])]) {
    const k = key(a)
    if (!aliasMap.has(k)) aliasMap.set(k, b.n)
  }
}

/** Find a book by any name or short name. A start of a name also works ("deut", "filip"). */
export function findBook(text: string): number | null {
  const k = key(text)
  if (!k) return null
  const exact = aliasMap.get(k)
  if (exact) return exact
  // Start of a name, in book order ("jo" → Josué). Numbered books need the number.
  const match = books.find((b) => key(b.name).startsWith(k))
  return match?.n ?? null
}

export interface ParsedRef {
  book: number
  chapter?: number
  from?: number
  to?: number
}

/**
 * Read a reference: "jn 3 16", "juan 3:16", "sal 23:1-4", "1 co 13", "jud 5".
 * Returns null if the text is not a reference (then it is a word search).
 * `chapterCount` tells which books have one chapter, so "jud 5" means verse 5.
 */
export function parseReference(text: string, chapterCount: (book: number) => number): ParsedRef | null {
  const m = /^\s*([1-3]?\s*\.?\s*[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ.]+(?:\s+[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ]+)*?)\s*(\d+)?(?:\s*[:.,\s]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/.exec(text)
  if (!m) return null
  const book = findBook(m[1])
  if (!book) return null
  let chapter = m[2] ? Number(m[2]) : undefined
  let from = m[3] ? Number(m[3]) : undefined
  let to = m[4] ? Number(m[4]) : undefined
  // One-chapter books: "jud 5" is verse 5, "jud 3-5" is verses 3 to 5.
  if (chapterCount(book) === 1 && chapter !== undefined && from === undefined) {
    from = chapter
    chapter = 1
  }
  if (from !== undefined && to !== undefined && to < from) [from, to] = [to, from]
  return { book, chapter, from, to }
}

export function bookName(n: number): string {
  return books[n - 1]?.name ?? `Libro ${n}`
}

/** "Salmos 23:1-4", "Juan 3:16", "Salmos 23". */
export function refLabel(ref: { book: number; chapter: number; from?: number; to?: number }): string {
  const base = `${bookName(ref.book)} ${ref.chapter}`
  if (!ref.from) return base
  return ref.to && ref.to !== ref.from ? `${base}:${ref.from}-${ref.to}` : `${base}:${ref.from}`
}
