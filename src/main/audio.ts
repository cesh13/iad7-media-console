import { BrowserWindow } from 'electron'
import { stat, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { AudioRender, AudioSettings, AudioState, MediaRef, Settings } from '../shared/types'
import { byFileName, typeByExtension } from './fileTypes'
import { mediaRef } from './groups'
import { loadPage, preloadPath } from './pages'
import { saveSettings } from './settings'

/**
 * Background music and audio items (SPEC 5.6). The sound plays in a hidden
 * window; this module holds the state and tells that window what to play.
 * Videos keep their sound in the output window that owns it.
 */

const fadeOutMs = 3000
/** Music level while a video plays (auto duck). */
const duckLevel = 0.25

let settings: Settings
let win: BrowserWindow | null = null
let index = 0
let playing = false
let musicTake = 0
let fadeOutId = 0
let fadeTimer: NodeJS.Timeout | null = null
let position: AudioState['position'] = null
let item: (AudioState['item'] & { url: string; take: number }) | null = null
let itemTake = 0
let ducked = false
/** Latest level of each player (audio window, output windows), with the time it came. */
const levels = new Map<string, { l: number; r: number; at: number }>()
/** Tracks already played in shuffle mode, so each plays once before repeats. */
let shufflePlayed = new Set<number>()

let videoPlaying: () => boolean = () => false
let notify: () => void = () => {}
let onItemEnded: (itemId: string) => void = () => {}
let notifyTimer: NodeJS.Timeout | null = null

export function defaultAudioSettings(): AudioSettings {
  return { playlist: [], shuffle: false, musicVolume: 0.35, itemsVolume: 0.8, device: '', autoDuck: true, startAfterLast: false }
}

export function audioSettings(): AudioSettings {
  return settings.audio ?? defaultAudioSettings()
}

export function connectAudio(
  s: Settings,
  options: { videoPlaying: () => boolean; onChange: () => void; onItemEnded: (itemId: string) => void }
): void {
  settings = s
  settings.audio = { ...defaultAudioSettings(), ...settings.audio }
  videoPlaying = options.videoPlaying
  notify = options.onChange
  onItemEnded = options.onItemEnded
  // The cached copies of the music may be gone (cache cleared): copy again.
  settings.audio.playlist = settings.audio.playlist.map((m) => mediaRef(m.path) ?? m)
  ensureWindow()
}

/** Tell the control window, at most 10 times a second. */
function changed(): void {
  if (notifyTimer) return
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    notify()
  }, 100)
}

function save(): void {
  saveSettings(settings)
}

function ensureWindow(): void {
  if (win && !win.isDestroyed()) return
  win = new BrowserWindow({
    show: false,
    webPreferences: { preload: preloadPath(), sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  })
  win.webContents.on('did-finish-load', render)
  // If the window dies, open it again so the music does not stay silent.
  win.on('closed', () => {
    win = null
    setTimeout(ensureWindow, 1000)
  })
  win.webContents.on('render-process-gone', () => win?.reload())
  loadPage(win, 'output', { mode: 'audio' })
}

export function closeAudioWindow(): void {
  const w = win
  win = null
  if (w && !w.isDestroyed()) {
    w.removeAllListeners('closed')
    w.destroy()
  }
}

/** Send the current state to the hidden audio window. */
function render(): void {
  const a = audioSettings()
  ducked = a.autoDuck && videoPlaying()
  const track = a.playlist[index]
  const r: AudioRender = {
    device: a.device,
    music: track?.url
      ? { url: track.url, take: musicTake, playing, volume: a.musicVolume * (ducked ? duckLevel : 1), fadeOutId: fadeOutId || undefined }
      : null,
    item: item ? { url: item.url, take: item.take, playing: item.playing, volume: a.itemsVolume } : null
  }
  if (win && !win.isDestroyed()) win.webContents.send('audio:render', r)
  changed()
}

export function audioState(): AudioState {
  const now = Date.now()
  let l = 0
  let r = 0
  for (const v of levels.values()) {
    if (now - v.at > 400) continue
    l = Math.max(l, v.l)
    r = Math.max(r, v.r)
  }
  return {
    settings: audioSettings(),
    index,
    playing,
    ducked,
    position,
    item: item ? { itemId: item.itemId, title: item.title, playing: item.playing, time: item.time, duration: item.duration } : null,
    levels: { l, r }
  }
}

/** Call when videos start or stop, so auto duck follows. */
export function videoStateChanged(): void {
  const before = ducked
  const now = audioSettings().autoDuck && videoPlaying()
  if (now !== before) render()
}

export function updateAudio(change: Partial<Omit<AudioSettings, 'playlist'>>): void {
  settings.audio = { ...audioSettings(), ...change }
  if (change.shuffle !== undefined) shufflePlayed = new Set([index])
  save()
  render()
}

const audioExtensions = new Set(Object.entries(typeByExtension).filter(([, t]) => t === 'audio').map(([e]) => e))

/** Add music files; a folder adds its music files in file-name order. */
export async function addMusic(paths: string[]): Promise<void> {
  const files: string[] = []
  for (const p of paths) {
    const info = await stat(p).catch(() => null)
    if (info?.isDirectory()) {
      const names = (await readdir(p)).filter((n) => audioExtensions.has(extname(n).toLowerCase())).sort(byFileName)
      files.push(...names.map((n) => join(p, n)))
    } else if (audioExtensions.has(extname(p).toLowerCase())) {
      files.push(p)
    }
  }
  const refs = files.map((f) => mediaRef(f)).filter((m): m is MediaRef => !!m)
  settings.audio = { ...audioSettings(), playlist: [...audioSettings().playlist, ...refs] }
  save()
  render()
}

export function clearPlaylist(): void {
  settings.audio = { ...audioSettings(), playlist: [] }
  playing = false
  index = 0
  position = null
  save()
  render()
}

function cancelFade(): void {
  if (fadeTimer) clearTimeout(fadeTimer)
  fadeTimer = null
  fadeOutId = 0
}

export function play(i?: number): void {
  const list = audioSettings().playlist
  if (list.length === 0) return
  cancelFade()
  if (i !== undefined && i !== index) {
    index = Math.max(0, Math.min(i, list.length - 1))
    musicTake++
    position = null
  }
  playing = true
  shufflePlayed.add(index)
  render()
}

export function pause(): void {
  cancelFade()
  playing = false
  render()
}

/** The next track: in order, or a random one not played yet (shuffle). */
export function next(): void {
  const list = audioSettings().playlist
  if (list.length === 0) return
  let n = (index + 1) % list.length
  if (audioSettings().shuffle && list.length > 1) {
    if (shufflePlayed.size >= list.length) shufflePlayed = new Set([index])
    const left = list.map((_, i) => i).filter((i) => !shufflePlayed.has(i))
    n = left[Math.floor(Math.random() * left.length)]
  }
  index = n
  musicTake++
  position = null
  play()
}

export function previous(): void {
  const list = audioSettings().playlist
  if (list.length === 0) return
  // In the first seconds of a track, go to the track before; later, start this one again.
  if (position && position.time > 4) {
    musicTake++
  } else {
    index = (index - 1 + list.length) % list.length
    musicTake++
  }
  position = null
  play()
}

/** Lower the music to silence in 3 seconds, then pause. */
export function fadeOut(): void {
  if (!playing || fadeTimer) return
  fadeOutId = Date.now()
  render()
  fadeTimer = setTimeout(() => {
    fadeTimer = null
    fadeOutId = 0
    playing = false
    render()
  }, fadeOutMs)
}

/** The last item of the order ended: start the music, if that option is on. */
export function orderEnded(): void {
  if (audioSettings().startAfterLast && !playing) play()
}

// ---- Audio items from the order ----

export function playItem(itemId: string, title: string, url: string): void {
  item = { itemId, title, url, take: ++itemTake, playing: true, time: 0, duration: 0 }
  render()
}

export function stopItem(): void {
  item = null
  render()
}

/** Reports from the hidden audio window. */
export function report(r: {
  musicTake?: number
  musicTime?: number
  musicDuration?: number
  musicEnded?: boolean
  itemTake?: number
  itemTime?: number
  itemDuration?: number
  itemEnded?: boolean
}): void {
  if (r.musicTake === musicTake) {
    if (r.musicEnded) {
      // During a fade out (or after a pause) the music stops; it does not go on to the next track.
      if (fadeTimer || !playing) {
        cancelFade()
        playing = false
        index = (index + 1) % Math.max(1, audioSettings().playlist.length)
        musicTake++
        position = null
        return render()
      }
      return next()
    }
    if (r.musicTime !== undefined) position = { time: r.musicTime, duration: r.musicDuration ?? 0 }
    changed()
  }
  if (item && r.itemTake === item.take) {
    if (r.itemEnded) {
      const id = item.itemId
      item = null
      render()
      onItemEnded(id)
      return
    }
    if (r.itemTime !== undefined) {
      item.time = r.itemTime
      item.duration = r.itemDuration ?? 0
    }
    changed()
  }
}

export function setLevels(source: string, l: number, r: number): void {
  levels.set(source, { l, r, at: Date.now() })
  changed()
}
