import { randomUUID } from 'node:crypto'
import { startMinutes } from '../shared/program'
import type { Preset, PresetInfo, PresetSummary, Service, Settings } from '../shared/types'
import * as svc from './service'
import { createService } from './serviceStore'
import { saveSettings } from './settings'

/**
 * Presets (SPEC 5.7): a saved copy of an order and its program, with the days
 * and the time it is usually used. Starting a preset always makes a new
 * service, so changes in that service never change the preset.
 */

let settings: Settings
let notify: () => void = () => {}

export function connectPresets(s: Settings, onChange: () => void): void {
  settings = s
  notify = onChange
}

function all(): Preset[] {
  return settings.presets ?? []
}

function findByName(name: string): Preset | undefined {
  return all().find((p) => p.name.toLowerCase() === name.toLowerCase())
}

function cleanInfo(info: PresetInfo): PresetInfo {
  return {
    name: info.name.trim(),
    days: [...new Set(info.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b),
    time: startMinutes(info.time) === null ? '' : info.time
  }
}

/** Earliest in the week first. Presets without a day come last. */
export function presetSummaries(): PresetSummary[] {
  return all()
    .map(({ id, name, days, time, items }) => ({ id, name, days, time, items: items.length }))
    .sort((a, b) => (a.days[0] ?? 7) - (b.days[0] ?? 7) || a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
}

/** Save the order and program of this service. The same name replaces that preset. */
export function saveAsPreset(info: PresetInfo): void {
  const clean = cleanInfo(info)
  if (!clean.name) return
  const same = findByName(clean.name)
  const preset: Preset = { ...clean, id: same?.id ?? randomUUID(), items: svc.orderSnapshot(), program: svc.program().map((p) => ({ ...p })) }
  settings.presets = same ? all().map((p) => (p.id === same.id ? preset : p)) : [...all(), preset]
  saveSettings(settings)
  // This also sends the new list of presets to the control window.
  svc.setPresetId(preset.id)
}

/** Change the name, days or time. The order and program stay the same. */
export function updatePreset(id: string, info: PresetInfo): void {
  const clean = cleanInfo(info)
  const same = findByName(clean.name)
  if (!clean.name || (same && same.id !== id)) return
  settings.presets = all().map((p) => (p.id === id ? { ...p, ...clean } : p))
  saveSettings(settings)
  notify()
}

export function deletePreset(id: string): void {
  settings.presets = all().filter((p) => p.id !== id)
  saveSettings(settings)
  notify()
}

/** A new service with a fresh copy of the preset. */
export function serviceFromPreset(id: string): Service | null {
  const preset = all().find((p) => p.id === id)
  if (!preset) return null
  const service = createService(preset.program, preset.name)
  service.items = preset.items.map(svc.freshItem)
  service.presetId = preset.id
  return service
}
