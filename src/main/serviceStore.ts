import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProgramPart, Service, ServiceSummary } from '../shared/types'

function servicesDir(): string {
  const dir = join(app.getPath('userData'), 'services')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function serviceFile(id: string): string {
  return join(servicesDir(), `${id}.json`)
}

/** A new service, named like "Culto · sáb 31 oct" (the date in Spanish). */
export function createService(template: ProgramPart[] = []): Service {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const label = now.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '')
  // The program starts as a copy of the template (new ids, so edits do not change the template).
  const program = template.map((p) => ({ ...p, id: randomUUID() }))
  return { id: randomUUID(), name: `Culto · ${label}`, date, items: [], program }
}

/** All saved services, newest first. */
export function listServices(): ServiceSummary[] {
  const list: ServiceSummary[] = []
  for (const name of readdirSync(servicesDir())) {
    if (!name.endsWith('.json')) continue
    const s = loadService(name.slice(0, -5))
    if (s) list.push({ id: s.id, name: s.name, date: s.date, items: s.items.length })
  }
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
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
