import { startMinutes } from './program'

/** The date as saved in a service: YYYY-MM-DD in local time. */
export function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * The preset to recommend now: among the presets used on this day of the
 * week, the one with the usual time closest to now. A preset without a time
 * comes after the ones with a time. No preset for this day: null.
 */
export function recommendedPreset<T extends { days: number[]; time: string }>(presets: T[], now: Date): T | null {
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  let best: T | null = null
  let bestGap = Infinity
  for (const preset of presets) {
    if (!preset.days.includes(now.getDay())) continue
    const minutes = startMinutes(preset.time)
    const gap = minutes === null ? 24 * 60 : Math.abs(minutes - minutesNow)
    if (gap < bestGap) {
      best = preset
      bestGap = gap
    }
  }
  return best
}
