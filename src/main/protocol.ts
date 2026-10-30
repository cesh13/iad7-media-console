import { protocol } from 'electron'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { cacheDir } from './cache'

const mimeTypes: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac'
}

/** The app pages (file:// or the dev server) may read these files, also for the level meter. */
const cors = { 'Access-Control-Allow-Origin': '*' }

export function mimeType(file: string): string {
  return mimeTypes[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * The file for a path in the media cache ("/abc/page-1.png"), or null.
 * Only files inside the cache folder: no "..", no other folders.
 */
export function cacheFile(pathname: string): string | null {
  const root = cacheDir()
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

/** Must run before the app is ready. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    // corsEnabled: the level meter may read the sound of media:// files.
    { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
  ])
}

/**
 * Serve files from the media cache as media://cache/<path in the cache>.
 * Only files inside the cache folder can be loaded. Range requests are
 * supported, so the video player can jump to any time.
 */
export function handleMediaScheme(): void {
  protocol.handle('media', (request) => {
    const url = new URL(request.url)
    const file = url.hostname === 'cache' ? cacheFile(url.pathname) : null
    if (!file) return new Response('Not found', { status: 404 })
    const size = statSync(file).size
    const type = mimeType(file)
    const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') ?? '')

    if (!range) {
      const body = Readable.toWeb(createReadStream(file)) as ReadableStream
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes', ...cors }
      })
    }

    let start = range[1] ? Number(range[1]) : 0
    let end = range[2] ? Number(range[2]) : size - 1
    if (!range[1] && range[2]) {
      // "bytes=-500" means the last 500 bytes.
      start = Math.max(0, size - Number(range[2]))
      end = size - 1
    }
    end = Math.min(end, size - 1)
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        ...cors
      }
    })
  })
}
