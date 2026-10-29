import type { CacheState, ItemType } from '../shared/types'
import { cacheFile, mediaUrl } from './cache'
import { readTextFile } from './fileText'
import { renderPdfPages } from './pdfPages'
import { convertToPdf } from './pptx'

/**
 * Make a file ready to show: copy it to the local cache, then (by type)
 * convert .pptx to PDF and make page pictures, or read the song text.
 * Every step reuses earlier results, so calling it again is fast.
 * Used by order items and by the shared folder (which prepares files early).
 */

export interface Prepared {
  localCopyPath: string
  url: string
  pageUrls?: string[]
  pageTexts?: string[]
  stanzas?: string[]
}

export type PrepareState = Exclude<CacheState, 'ready' | 'error'>

/** Split song text into stanzas at empty lines. */
export function stanzas(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function prepareFile(
  path: string,
  type: ItemType,
  onState: (state: PrepareState, fraction?: number) => void
): Promise<Prepared> {
  onState('copying', 0)
  const cached = await cacheFile(path, (f) => onState('copying', f))
  if (type === 'song') {
    return { localCopyPath: cached, url: mediaUrl(cached), stanzas: stanzas(await readTextFile(cached)) }
  }
  if (type === 'slides') {
    // .pptx: convert to PDF first. Then make one picture per page.
    let pdf = cached
    if (!cached.toLowerCase().endsWith('.pdf')) {
      onState('converting')
      pdf = await convertToPdf(cached)
    }
    onState('rendering', 0)
    const pages = await renderPdfPages(pdf, (f) => onState('rendering', f))
    return { localCopyPath: cached, url: pages.pageUrls[0], pageUrls: pages.pageUrls, pageTexts: pages.texts }
  }
  return { localCopyPath: cached, url: mediaUrl(cached) }
}
