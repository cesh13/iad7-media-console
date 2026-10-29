import { app } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Settings } from '../shared/types'

const defaults: Settings = { outputs: [] }

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  const file = settingsPath()
  if (!existsSync(file)) return structuredClone(defaults)
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>
    return { ...structuredClone(defaults), ...data }
  } catch (err) {
    console.error('Could not read settings, using defaults:', err)
    return structuredClone(defaults)
  }
}

/** Write to a temporary file first, then rename, so a crash cannot leave half a file. */
export function saveSettings(settings: Settings): void {
  const file = settingsPath()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8')
  renameSync(tmp, file)
}
