import { app } from 'electron'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { rename, stat, unlink } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'

/**
 * Local cache of media files. The app plays only from here, never directly
 * from the original file, because the original may be on a network share
 * that is slow or goes away during the service.
 */
export function cacheDir(): string {
  const dir = join(app.getPath('userData'), 'media-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Copy a file into the cache and return the cached path.
 * The cache file name depends on the source path, size and change time,
 * so a changed source file gets a new copy and an unchanged one is not copied again.
 */
export async function cacheFile(source: string, onProgress: (fraction: number) => void): Promise<string> {
  const info = await stat(source)
  const key = createHash('sha1').update(`${source}|${info.size}|${info.mtimeMs}`).digest('hex').slice(0, 16)
  const target = join(cacheDir(), `${key}${extname(source).toLowerCase()}`)

  if (existsSync(target) && (await stat(target)).size === info.size) {
    onProgress(1)
    return target
  }

  // Copy to a temporary name first, so a half copy is never used.
  const tmp = `${target}.part`
  let copied = 0
  let lastReport = 0
  const input = createReadStream(source)
  input.on('data', (chunk) => {
    copied += chunk.length
    const now = Date.now()
    if (now - lastReport > 200) {
      lastReport = now
      onProgress(info.size ? copied / info.size : 1)
    }
  })
  try {
    await pipeline(input, createWriteStream(tmp))
    await rename(tmp, target)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }
  onProgress(1)
  return target
}

/** The URL windows use to load a cached file (also files in subfolders of the cache). See protocol.ts. */
export function mediaUrl(cachedPath: string): string {
  const parts = relative(cacheDir(), cachedPath).split(sep).map(encodeURIComponent)
  return `media://cache/${parts.join('/')}`
}
