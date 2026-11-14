import { app, net } from 'electron'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BibleCatalogEntry } from '../shared/types'
import { importBible, listBibles } from './bible'

/**
 * Bible versions to download inside the app, from the free getbible.net
 * catalog (texts from the CrossWire project). The list has only versions
 * that may be shared; versions like RVR1960 or NVI are not in it, because
 * they need a license (import those from a file).
 */

const catalogUrl = 'https://api.getbible.net/v2/translations.json'
const versionUrl = (id: string) => `https://api.getbible.net/v2/${id}.json`
/** Use the saved list for one day before asking the server again. */
const catalogMaxAge = 24 * 60 * 60 * 1000

/** Short names people know, for the version selector. Others use the catalog abbreviation. */
const shortNames: Record<string, string> = {
  valera: 'RV1909',
  rv1858: 'RV1858',
  sse: 'SE1569',
  kjv: 'KJV',
  akjv: 'AKJV',
  asv: 'ASV',
  web: 'WEB',
  almeida: 'ALM'
}

interface RawEntry {
  translation: string
  abbreviation: string
  lang: string
  language: string
  distribution_license?: string
  distribution_about?: string
}

function dir(): string {
  const d = join(app.getPath('userData'), 'bibles')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

const cacheFile = () => join(dir(), 'catalog.json')

/** Catalog text uses RTF marks (\par); make it plain text. */
function plain(text = ''): string {
  return text
    .replace(/\\par\b/g, '\n')
    .replace(/\\[a-z]+\d* ?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const installedId = (catalogId: string) => `gb-${catalogId}`

function toEntries(raw: Record<string, RawEntry>): BibleCatalogEntry[] {
  const installed = new Set(listBibles().map((b) => b.id))
  return Object.values(raw)
    .map((r) => ({
      id: r.abbreviation,
      name: r.translation,
      abbrev: shortNames[r.abbreviation] ?? r.abbreviation.toUpperCase(),
      lang: r.lang,
      language: r.language,
      license: r.distribution_license || 'Unknown',
      about: plain(r.distribution_about).slice(0, 600),
      installed: installed.has(installedId(r.abbreviation))
    }))
    .sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name))
}

/** The list of versions: from the saved copy if it is new, else from the server. */
export async function bibleCatalog(refresh = false): Promise<{ entries: BibleCatalogEntry[]; error?: string }> {
  let saved: { at: number; data: Record<string, RawEntry> } | null = null
  try {
    if (existsSync(cacheFile())) saved = JSON.parse(readFileSync(cacheFile(), 'utf8'))
  } catch {
    saved = null
  }
  if (saved && !refresh && Date.now() - saved.at < catalogMaxAge) return { entries: toEntries(saved.data) }
  try {
    const res = await net.fetch(catalogUrl)
    if (!res.ok) throw new Error(`The server answered ${res.status}`)
    const data = (await res.json()) as Record<string, RawEntry>
    writeFileSync(cacheFile(), JSON.stringify({ at: Date.now(), data }), 'utf8')
    return { entries: toEntries(data) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // No internet: show the old list if there is one.
    if (saved) return { entries: toEntries(saved.data), error: message }
    return { entries: [], error: message }
  }
}

/** Download one version, then import it like a file. Progress is 0..1 (or -1 when the size is not known). */
export async function downloadBible(catalogId: string, onProgress: (fraction: number) => void): Promise<void> {
  if (!/^[a-z0-9_-]+$/i.test(catalogId)) throw new Error('Unknown version')
  const { entries } = await bibleCatalog()
  const entry = entries.find((e) => e.id === catalogId)
  if (!entry) throw new Error('This version is not in the catalog')

  const res = await net.fetch(versionUrl(catalogId))
  if (!res.ok || !res.body) throw new Error(`The server answered ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const tmp = join(dir(), `download-${catalogId}.json`)
  const file = createWriteStream(tmp)
  let received = 0
  let lastReport = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (!file.write(value)) await new Promise((r) => file.once('drain', r))
      const now = Date.now()
      if (now - lastReport > 200) {
        lastReport = now
        onProgress(total ? received / total : -1)
      }
    }
    await new Promise<void>((resolve, reject) => file.end((err?: Error | null) => (err ? reject(err) : resolve())))
    onProgress(1)
    await importBible(tmp, { id: installedId(catalogId), name: entry.name, abbrev: entry.abbrev })
  } finally {
    file.destroy()
    rmSync(tmp, { force: true })
  }
}
