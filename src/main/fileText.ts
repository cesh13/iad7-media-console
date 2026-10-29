import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { readZipTexts } from './zip'

/**
 * The text in a file, for the folder search (hymn lyrics):
 * - .pptx / .ppsx: the text of all slides, read from the zip, without LibreOffice
 * - .odp: the text of the presentation
 * - .txt: the file itself
 * Other files have no text; they are found by number and title only.
 */
export async function fileText(path: string): Promise<string> {
  const ext = extname(path).toLowerCase()
  try {
    if (ext === '.pptx' || ext === '.ppsx') {
      const slides = await readZipTexts(path, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      return [...slides.values()].map(xmlText).join('\n')
    }
    if (ext === '.odp') {
      const content = await readZipTexts(path, (n) => n === 'content.xml')
      return xmlText(content.get('content.xml') ?? '')
    }
    if (ext === '.txt') return await readTextFile(path)
  } catch {
    // A damaged or locked file: search by name only.
  }
  return ''
}

/** Text files from Windows are often not UTF-8. Fall back to Windows-1252 (Latin). */
export async function readTextFile(path: string): Promise<string> {
  const buf = await readFile(path)
  const utf8 = buf.toString('utf8').replace(/^﻿/, '')
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(buf)
}

/** Text runs of Office XML (<a:t> in PowerPoint, <text:p> in ODF), one paragraph per line. */
function xmlText(xml: string): string {
  return xml
    .replace(/<\/a:p>|<\/text:p>|<a:br\/>|<text:line-break\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}
