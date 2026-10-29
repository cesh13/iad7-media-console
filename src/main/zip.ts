import { open } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'

/**
 * Read single files from a zip file (a .pptx is a zip of XML files) without
 * reading the whole file. Only "stored" and "deflate" entries are supported,
 * which is what Office uses.
 */

interface Entry {
  name: string
  method: number
  compressedSize: number
  localHeader: number
}

async function readAt(handle: Awaited<ReturnType<typeof open>>, position: number, length: number): Promise<Buffer> {
  const buf = Buffer.alloc(length)
  const { bytesRead } = await handle.read(buf, 0, length, position)
  return buf.subarray(0, bytesRead)
}

/** All entries whose name matches `filter`, as text, in name order. */
export async function readZipTexts(path: string, filter: (name: string) => boolean): Promise<Map<string, string>> {
  const handle = await open(path, 'r')
  try {
    const { size } = await handle.stat()
    // The end record is in the last 64 KB + 22 bytes of the file.
    const tailLength = Math.min(size, 65_557)
    const tail = await readAt(handle, size - tailLength, tailLength)
    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new Error('Not a zip file')
    const count = tail.readUInt16LE(eocd + 10)
    const dirSize = tail.readUInt32LE(eocd + 12)
    const dirOffset = tail.readUInt32LE(eocd + 16)

    const dir = await readAt(handle, dirOffset, dirSize)
    const entries: Entry[] = []
    let p = 0
    for (let i = 0; i < count && p + 46 <= dir.length; i++) {
      if (dir.readUInt32LE(p) !== 0x02014b50) break
      const method = dir.readUInt16LE(p + 10)
      const compressedSize = dir.readUInt32LE(p + 20)
      const nameLength = dir.readUInt16LE(p + 28)
      const extraLength = dir.readUInt16LE(p + 30)
      const commentLength = dir.readUInt16LE(p + 32)
      const localHeader = dir.readUInt32LE(p + 42)
      const name = dir.subarray(p + 46, p + 46 + nameLength).toString('utf8')
      if (filter(name)) entries.push({ name, method, compressedSize, localHeader })
      p += 46 + nameLength + extraLength + commentLength
    }

    const out = new Map<string, string>()
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      const header = await readAt(handle, e.localHeader, 30)
      const start = e.localHeader + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
      const data = await readAt(handle, start, e.compressedSize)
      if (e.method === 0) out.set(e.name, data.toString('utf8'))
      else if (e.method === 8) out.set(e.name, inflateRawSync(data).toString('utf8'))
    }
    return out
  } finally {
    await handle.close()
  }
}
