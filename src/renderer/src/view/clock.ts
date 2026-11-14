import { useEffect, useState } from 'react'

/** The time now, updated every `ms` milliseconds (for clocks and countdowns). */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}

/** "4:12", "1:04:12", or "+2:15" after the end (negative seconds). */
export function formatCountdown(seconds: number): string {
  const over = seconds < 0
  const s = Math.abs(over ? Math.floor(seconds) : Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  const text = h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
  return over && s > 0 ? `+${text}` : text
}

/** "10:42" (24-hour clock, as used in the church). */
export function formatClock(now: number): string {
  const d = new Date(now)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
