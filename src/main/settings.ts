import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GroupConfig, Settings } from '../shared/types'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function newGroup(name: string): GroupConfig {
  return { id: randomUUID(), name, outputIds: [], idle: 'black', idleMedia: [], idleInterval: 8 }
}

/** First run: the two groups from SPEC section 2. */
function defaults(): Settings {
  return { outputs: [], groups: [newGroup('Main'), newGroup('Stage')] }
}

export function loadSettings(): Settings {
  const file = settingsPath()
  if (!existsSync(file)) return defaults()
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>
    const settings: Settings = { ...defaults(), ...data }
    // Settings from step 2 have no groups: put all outputs in Main.
    if (!data.groups) settings.groups[0].outputIds = settings.outputs.map((o) => o.id)
    return settings
  } catch (err) {
    console.error('Could not read settings, using defaults:', err)
    return defaults()
  }
}

/** Write to a temporary file first, then rename, so a crash cannot leave half a file. */
export function saveSettings(settings: Settings): void {
  const file = settingsPath()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8')
  renameSync(tmp, file)
}
