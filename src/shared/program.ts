import type { ProgramPart } from './types'

/** "HH:MM" → minutes after midnight, or null when the time is not valid. */
export function startMinutes(start: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(start.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}

/** Parts with a valid time, earliest first. */
export function sortedParts(parts: ProgramPart[]): ProgramPart[] {
  return parts
    .filter((p) => startMinutes(p.start) !== null)
    .sort((a, b) => startMinutes(a.start)! - startMinutes(b.start)!)
}

/** The time (ms) today when a part starts. */
function startOfToday(start: string, now: Date): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime() + startMinutes(start)! * 60_000
}

export interface ProgramNow {
  /** The part that runs now: the last one that started. Null before the first part. */
  current: ProgramPart | null
  /** When the current part ends (ms): the start of the next part. Null for the last part. */
  endsAt: number | null
  next: ProgramPart | null
  /** When the next part starts (ms). */
  nextAt: number | null
}

/** Which part of the program runs at this time. The program follows the clock only. */
export function programAt(parts: ProgramPart[], now: number): ProgramNow {
  const list = sortedParts(parts)
  const date = new Date(now)
  let current: ProgramPart | null = null
  let next: ProgramPart | null = null
  for (const p of list) {
    if (startOfToday(p.start, date) <= now) current = p
    else {
      next = p
      break
    }
  }
  const nextAt = next ? startOfToday(next.start, date) : null
  return { current, endsAt: current ? nextAt : null, next, nextAt }
}
