import { useEffect, useRef, useState } from 'react'
import type { AudioRender } from '../../../shared/types'
import { applyDevice, meterElement } from '../view/levelMeter'

const api = window.mediaConsole

/**
 * The hidden audio window: background music and audio items. It plays only
 * what the main process sends, and reports time, end and output level.
 */
export function AudioPlayer() {
  const [render, setRender] = useState<AudioRender | null>(null)
  useEffect(() => api.onAudioRender(setRender), [])
  if (!render) return null
  return (
    <>
      {render.music && <Music key={render.music.take} music={render.music} device={render.device} />}
      {render.item && <ItemAudio key={render.item.take} item={render.item} device={render.device} />}
    </>
  )
}

/** Move the volume toward the target smoothly (duck, fade out), never in a jump. */
function useSmoothVolume(ref: React.RefObject<HTMLAudioElement | null>, target: number, seconds: number): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stepMs = 50
    const step = Math.max(0.0002, Math.abs(target - el.volume) / ((seconds * 1000) / stepMs))
    const timer = setInterval(() => {
      const v = el.volume
      if (Math.abs(target - v) <= step) {
        el.volume = Math.max(0, Math.min(1, target))
        clearInterval(timer)
      } else {
        el.volume = Math.max(0, Math.min(1, v + (target > v ? step : -step)))
      }
    }, stepMs)
    return () => clearInterval(timer)
  }, [target, seconds])
}

function Music({ music, device }: { music: NonNullable<AudioRender['music']>; device: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const lastReport = useRef(0)
  const fading = !!music.fadeOutId
  useSmoothVolume(ref, fading ? 0 : music.volume, fading ? 3 : 1)

  useEffect(() => applyDevice(ref.current, device), [device])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (music.playing) void el.play().catch(() => {})
    else el.pause()
  }, [music.playing])
  useEffect(() => (ref.current ? meterElement(ref.current, (l, r) => api.audioLevels('music', l, r)) : undefined), [])

  return (
    <audio
      ref={ref}
      src={music.url}
      crossOrigin="anonymous"
      onLoadedMetadata={(e) => {
        e.currentTarget.volume = 0
        if (music.playing) void e.currentTarget.play().catch(() => {})
      }}
      onTimeUpdate={(e) => {
        const now = Date.now()
        if (now - lastReport.current < 500) return
        lastReport.current = now
        api.audioReport({ musicTake: music.take, musicTime: e.currentTarget.currentTime, musicDuration: e.currentTarget.duration || 0 })
      }}
      onEnded={() => api.audioReport({ musicTake: music.take, musicEnded: true })}
    />
  )
}

function ItemAudio({ item, device }: { item: NonNullable<AudioRender['item']>; device: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const lastReport = useRef(0)
  useEffect(() => applyDevice(ref.current, device), [device])
  useEffect(() => {
    if (ref.current) ref.current.volume = item.volume
  }, [item.volume])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (item.playing) void el.play().catch(() => {})
    else el.pause()
  }, [item.playing])
  useEffect(() => {
    if (ref.current && item.seekTo !== undefined) ref.current.currentTime = item.seekTo
  }, [item.seekId])
  useEffect(() => (ref.current ? meterElement(ref.current, (l, r) => api.audioLevels('item', l, r)) : undefined), [])

  return (
    <audio
      ref={ref}
      src={item.url}
      crossOrigin="anonymous"
      autoPlay={item.playing}
      onTimeUpdate={(e) => {
        const now = Date.now()
        if (now - lastReport.current < 500) return
        lastReport.current = now
        api.audioReport({ itemTake: item.take, itemTime: e.currentTarget.currentTime, itemDuration: e.currentTarget.duration || 0 })
      }}
      onEnded={() => api.audioReport({ itemTake: item.take, itemEnded: true })}
    />
  )
}
