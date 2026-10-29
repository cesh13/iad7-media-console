import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Service } from '../shared/types'

function servicesDir(): string {
  const dir = join(app.getPath('userData'), 'services')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function serviceFile(id: string): string {
  return join(servicesDir(), `${id}.json`)
}

export function createService(): Service {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  return { id: randomUUID(), name: `Service · ${date}`, date, items: [] }
}

export function loadService(id: string): Service | null {
  const file = serviceFile(id)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Service
  } catch (err) {
    console.error('Could not read service file:', file, err)
    return null
  }
}

/** Write to a temporary file first, then rename, so a crash cannot leave half a file. */
export function saveService(service: Service): void {
  const file = serviceFile(service.id)
  const tmp = `${file}.tmp`
  // Progress numbers are only for the screen; do not save them.
  const items = service.items.map(({ cacheProgress: _p, ...rest }) => rest)
  writeFileSync(tmp, JSON.stringify({ ...service, items }, null, 2), 'utf8')
  renameSync(tmp, file)
}
