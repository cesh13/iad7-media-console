import { useEffect, useRef, useState } from 'react'
import type { ContentLayer, OutputRender, Overlays, TextLayer } from '../../../shared/types'
import { applyDevice, meterElement } from './levelMeter'
import { TextView } from './TextView'
import './view.css'

// One screen picture: idle screen, content, overlays (from bottom to top).
// Used by the output windows, the preview and the small live copies, so all
// three look the same.

export interface PlaybackReport {
  take: number
  currentTime: number
  duration: number
  playing: boolean
  ended: boolean
}

export interface ScreenViewProps {
  content: ContentLayer | null
  text?: TextLayer | null
  idle: OutputRender['idle']
  logoUrl?: string
  overlays: Overlays
  /** This view plays the sound. Only one output per take does. */
  audio?: boolean
  /** Called with the video time (play, pause, end, and up to 4 times a second). */
  onPlayback?: (report: PlaybackReport) => void
  /** Small copies follow the time of the real output. */
  syncTime?: number
  /** Sound of videos: master volume (0..1) and output device. Only used with `audio`. */
  itemsVolume?: number
  audioDevice?: string
}

const fadeSeconds = 1

export function ScreenView(props: ScreenViewProps) {
  const { content, overlays, text } = props
  // Full-screen text shows over the idle background (not over the logo).
  const textFull = !!text && text.settings.mode !== 'lower'
  const showIdle = !content && (!textFull || props.idle.kind === 'background' || props.idle.kind === 'loop')
  return (
    <div className="screen-view">
      {showIdle && <IdleScreen idle={props.idle} logoUrl={props.logoUrl} />}
      {content?.type === 'image' && <ImageContent key={content.take} content={content} />}
      {content?.type === 'slides' && <SlidesContent key={content.take} content={content} />}
      {content?.type === 'video' && (
        <VideoContent
          key={content.take}
          content={content}
          audio={!!props.audio}
          onPlayback={props.onPlayback}
          syncTime={props.syncTime}
          itemsVolume={props.itemsVolume ?? 1}
          audioDevice={props.audioDevice ?? ''}
        />
      )}
      {content?.ended && content.settings.endAction === 'black' && <div className="layer layer-black" />}
      {text && <TextView text={text} />}
      {overlays.logo && props.logoUrl && <LogoLayer url={props.logoUrl} />}
      {overlays.black && <div className="layer layer-black" />}
    </div>
  )
}

function LogoLayer({ url }: { url: string }) {
  return (
    <div className="layer layer-logo">
      <img src={url} alt="" />
    </div>
  )
}

// ---- Idle screen (SPEC section 8) ----

function IdleScreen({ idle, logoUrl }: { idle: OutputRender['idle']; logoUrl?: string }) {
  const { kind, media, interval } = idle
  if (kind === 'logo' && logoUrl) return <LogoLayer url={logoUrl} />
  if (kind === 'background' && media[0]) return <IdleMedia media={media[0]} loop />
  if (kind === 'loop' && media.length) return <IdleLoop media={media} interval={interval} />
  return null
}

function IdleMedia(props: { media: { type: string; url: string }; loop: boolean; onEnded?: () => void }) {
  if (props.media.type === 'image') return <img className="layer media-cover" src={props.media.url} alt="" />
  return <video className="layer media-cover" src={props.media.url} autoPlay muted loop={props.loop} onEnded={props.onEnded} />
}

/** Show the idle files one after the other: images for `interval` seconds, videos to the end. */
function IdleLoop({ media, interval }: { media: { type: string; url: string }[]; interval: number }) {
  const [index, setIndex] = useState(0)
  const current = media[index % media.length]
  const advance = () => setIndex((i) => (i + 1) % media.length)

  useEffect(() => {
    if (current.type !== 'image' || media.length < 2) return
    const timer = setTimeout(advance, interval * 1000)
    return () => clearTimeout(timer)
  }, [index, current.type, media.length, interval])

  return <IdleMedia key={`${index}-${current.url}`} media={current} loop={media.length === 1} onEnded={advance} />
}

// ---- Content ----

function ImageContent({ content }: { content: ContentLayer }) {
  const fit = content.settings.fit ?? 'fit'
  return (
    <>
      {fit === 'blur' && <img className="layer media-cover media-blur" src={content.url} alt="" />}
      <img className={fit === 'fill' ? 'layer media-cover' : 'layer media-contain'} src={content.url} alt="" />
    </>
  )
}

/**
 * One page of the slides. All pages are loaded when the slides go live, so
 * the next page shows at once, without a black flash.
 */
function SlidesContent({ content }: { content: ContentLayer }) {
  const urls = content.pageUrls ?? [content.url]
  const page = Math.min(content.page ?? 0, urls.length - 1)
  useEffect(() => {
    const images = urls.map((url) => {
      const img = new Image()
      img.src = url
      return img
    })
    return () => images.forEach((img) => (img.src = ''))
  }, [urls.join('|')])
  return <img className="layer media-contain" src={urls[page]} alt="" />
}

function VideoContent(props: {
  content: ContentLayer
  audio: boolean
  onPlayback?: (r: PlaybackReport) => void
  syncTime?: number
  itemsVolume: number
  audioDevice: string
}) {
  const { content, audio, onPlayback, syncTime, itemsVolume } = props
  const s = content.settings
  const ref = useRef<HTMLVideoElement>(null)
  const lastReport = useRef(0)
  const endedSent = useRef(false)
  const [opacity, setOpacity] = useState(s.fade ? 0 : 1)

  const start = s.start ?? 0
  const loop = s.endAction === 'loop'
  const volume = (s.volume ?? 1) * itemsVolume

  // The output with the sound: use the chosen device, and measure the level.
  const device = s.audioDevice || props.audioDevice
  useEffect(() => {
    if (audio) applyDevice(ref.current, device)
  }, [audio, device])
  useEffect(() => {
    if (!audio || !ref.current) return
    return meterElement(ref.current, (l, r) => window.mediaConsole.audioLevels('video', l, r))
  }, [audio])

  // Play or pause when the control window says so.
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (content.playing && !content.ended) void video.play().catch(() => {})
    else video.pause()
  }, [content.playing, content.ended])

  // Jump to a time.
  useEffect(() => {
    const video = ref.current
    if (video && content.seekId !== undefined && content.seekTo !== undefined) {
      video.currentTime = content.seekTo
      endedSent.current = false
    }
  }, [content.seekId])

  // Small copies follow the real output when they drift more than a little.
  useEffect(() => {
    const video = ref.current
    if (video && syncTime !== undefined && Math.abs(video.currentTime - syncTime) > 0.7) video.currentTime = syncTime
  }, [syncTime])

  const report = (ended: boolean, always = true) => {
    const video = ref.current
    if (!video || !onPlayback) return
    const now = Date.now()
    if (!always && now - lastReport.current < 250) return
    lastReport.current = now
    onPlayback({
      take: content.take,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      playing: !video.paused,
      ended
    })
  }

  const finish = () => {
    if (endedSent.current) return
    endedSent.current = true
    ref.current?.pause()
    report(true)
  }

  const onTimeUpdate = () => {
    const video = ref.current
    if (!video) return
    const end = s.end && s.end > start ? s.end : video.duration
    // Volume and picture fade near the start and the end.
    let level = 1
    if (s.fade && Number.isFinite(end)) {
      level = Math.min(1, (video.currentTime - start) / fadeSeconds, (end - video.currentTime) / fadeSeconds)
      level = Math.max(0, level)
    }
    setOpacity(level)
    video.volume = Math.max(0, Math.min(1, volume * level))
    // End point: loop back to the start point, or end the video.
    if (s.end && video.currentTime >= s.end) {
      if (loop) video.currentTime = start
      else finish()
    }
    report(false, false)
  }

  return (
    <video
      ref={ref}
      className="layer media-contain"
      style={{ opacity, transition: 'opacity 0.25s linear' }}
      src={content.url}
      crossOrigin="anonymous"
      muted={!audio}
      loop={loop && !s.end}
      onLoadedMetadata={(e) => {
        if (start) e.currentTarget.currentTime = start
        e.currentTarget.volume = s.fade ? 0 : Math.min(1, volume)
        if (!s.fade) setOpacity(1)
        if (content.playing && !content.ended) void e.currentTarget.play().catch(() => {})
        report(false)
      }}
      onTimeUpdate={onTimeUpdate}
      onPlay={() => report(false)}
      onPause={() => report(false)}
      onEnded={() => !loop && finish()}
    />
  )
}
