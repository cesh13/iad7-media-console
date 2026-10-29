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
  '.pdf': 'application/pdf'
}

/** Must run before the app is ready. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
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
    const root = cacheDir()
    const file = resolve(root, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent))
    // Only files inside the cache folder: no "..", no other folders.
    const inside = relative(root, file)
    if (url.hostname !== 'cache' || !inside || inside.startsWith('..') || !existsSync(file)) {
      return new Response('Not found', { status: 404 })
    }
    const size = statSync(file).size
    const type = mimeTypes[extname(file).toLowerCase()] ?? 'application/octet-stream'
    const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') ?? '')

    if (!range) {
      const body = Readable.toWeb(createReadStream(file)) as ReadableStream
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
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
        'Accept-Ranges': 'bytes'
      }
    })
  })
}
