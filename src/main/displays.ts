import { screen, type Display } from 'electron'
import type { Output, OutputStatus, ScreenInfo } from '../shared/types'

/**
 * The key we save for a screen: label + resolution + position.
 * Electron display ids can change after a restart or a cable change,
 * so we do not save only the id (SPEC section 2).
 */
function makeDisplayKey(label: string, d: Display): string {
  const { width, height, x, y } = d.bounds
  return `${label}|${width}x${height}|${x},${y}`
}

function toScreenInfo(d: Display, primaryId: number): ScreenInfo {
  const label = d.label?.trim() || `Display ${d.id}`
  return {
    electronId: d.id,
    displayKey: makeDisplayKey(label, d),
    label,
    width: d.bounds.width,
    height: d.bounds.height,
    x: d.bounds.x,
    y: d.bounds.y,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primaryId
  }
}

/** All screens, sorted left to right, then top to bottom. */
export function listScreens(): ScreenInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen
    .getAllDisplays()
    .map((d) => toScreenInfo(d, primaryId))
    .sort((a, b) => a.x - b.x || a.y - b.y)
}

function labelAndSize(key: string): string {
  // "label|WxH|x,y" -> "label|WxH"
  return key.split('|').slice(0, 2).join('|')
}

/**
 * Find the screen for each saved output.
 * 1. Same full key (label, resolution, position).
 * 2. Otherwise, the only screen with the same label and resolution
 *    (the screen moved in the Windows display settings).
 * If nothing matches, the screen is missing and the UI shows a warning.
 */
export function matchOutputs(outputs: Output[], screens: ScreenInfo[]): OutputStatus[] {
  const used = new Set<number>()
  const result = outputs.map((output): OutputStatus => {
    const exact = screens.find((s) => s.displayKey === output.displayKey)
    if (exact) used.add(exact.electronId)
    return { output, screen: exact ?? null }
  })
  for (const status of result) {
    if (status.screen) continue
    const candidates = screens.filter(
      (s) => !used.has(s.electronId) && labelAndSize(s.displayKey) === labelAndSize(status.output.displayKey)
    )
    if (candidates.length === 1) {
      status.screen = candidates[0]
      used.add(candidates[0].electronId)
    }
  }
  return result
}
