import { randomUUID } from 'node:crypto'
import type { GroupConfig, SavedMessage, Settings, StageRender, StageTimer } from '../shared/types'
import { saveSettings } from './settings'
import * as svc from './service'

/**
 * The Stage screen (SPEC 7): the participant countdown, messages only for
 * the people on the platform, and what the stage screens show.
 * Lower-third messages for the audience are saved here too (Message tab).
 */

let settings: Settings
let notify: () => void = () => {}
let timer: StageTimer = { label: 'Sermón', duration: 30 * 60, running: false, endsAt: null, remaining: 30 * 60 }
let message: string | null = null

export function connectStage(s: Settings, onChange: () => void): void {
  settings = s
  notify = onChange
}

export function stageTimer(): StageTimer {
  return timer
}

export function stageMessage(): string | null {
  return message
}

export function savedMessages(): SavedMessage[] {
  return settings.messages ?? []
}

// ---- Participant countdown ----

export function timerSet(label: string, seconds: number): void {
  const s = Math.max(0, Math.round(seconds))
  timer = { label: label.trim() || timer.label, duration: s, running: false, endsAt: null, remaining: s }
  notify()
}

export function timerStart(): void {
  if (timer.running) return
  timer = { ...timer, running: true, endsAt: Date.now() + timer.remaining * 1000 }
  notify()
}

export function timerPause(): void {
  if (!timer.running || timer.endsAt === null) return
  timer = { ...timer, running: false, remaining: Math.round((timer.endsAt - Date.now()) / 1000), endsAt: null }
  notify()
}

export function timerReset(): void {
  timer = { ...timer, running: false, endsAt: null, remaining: timer.duration }
  notify()
}

// ---- Messages ----

export function setStageMessage(text: string | null): void {
  message = text?.trim() || null
  notify()
}

export function saveMessage(line1: string, line2: string): void {
  if (!line1.trim() && !line2.trim()) return
  settings.messages = [...savedMessages(), { id: randomUUID(), line1: line1.trim(), line2: line2.trim() }]
  saveSettings(settings)
  notify()
}

export function deleteMessage(id: string): void {
  settings.messages = savedMessages().filter((m) => m.id !== id)
  saveSettings(settings)
  notify()
}

// ---- What a stage screen shows ----

/**
 * The stage layout of a group: clock and timer are drawn by the screen; this
 * gives the timer, message, now, next, notes, and a copy of what the audience
 * sees (the group's own content, or else the first normal group's).
 */
export function stageRender(group: GroupConfig, groups: GroupConfig[]): StageRender {
  const own = svc.groupLive(group.id)
  const main = own.content || own.text ? group : (groups.find((g) => !g.stageView && g.outputIds.length) ?? groups.find((g) => !g.stageView))
  const mirrorLive = main ? svc.groupLive(main.id) : { content: null, text: null }
  const info = svc.stageInfo(main?.id ?? group.id)
  const countdown = groups
    .map((g) => svc.groupLive(g.id).content)
    .find((c) => c?.type === 'countdown' && c.settings.showOnStage && c.endsAt)
  return {
    timer,
    countdown: countdown ? { label: countdown.settings.textAbove || info.countdownTitle || 'Countdown', endsAt: countdown.endsAt! } : null,
    message,
    now: info.now,
    next: info.next,
    mirror: {
      content: mirrorLive.content,
      text: mirrorLive.text,
      idle: {
        kind: main?.idle ?? 'black',
        media: (main?.idleMedia ?? [])
          .filter((m) => m.url && m.type !== 'audio')
          .map((m) => ({ type: m.type as 'image' | 'video', url: m.url! })),
        interval: main?.idleInterval ?? 8
      }
    }
  }
}
