import { useEffect, useRef, useState } from 'react'
import type { ContentLayer, OutputRender } from '../../../shared/types'

const api = window.mediaConsole

/**
 * A real output window. It shows only what the main process sends.
 * Layers, from bottom to top: idle screen, content, overlays (logo, black).
 */
export function LiveOutput() {
  const [render, setRender] = useState<OutputRender | null>(null)
  useEffect(() => api.onOutputRender(setRender), [])

  if (!render) return <div className="live" />

  const { content, overlays } = render
  return (
    <div className="live">
      {!content && <IdleScreen render={render} />}
      {content?.type === 'image' && <img key={content.take} className="layer media-contain" src={content.url} alt="" />}
      {content?.type === 'video' && (
        <LiveVideo key={content.take} content={content} audio={render.audioTakes.includes(content.take)} />
      )}
      {overlays.logo && render.logoUrl && <LogoLayer url={render.logoUrl} />}
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

/** What the group shows when nothing is live (SPEC section 8). */
function IdleScreen({ render }: { render: OutputRender }) {
  const { kind, media, interval } = render.idle
  if (kind === 'logo' && render.logoUrl) return <LogoLayer url={render.logoUrl} />
  if (kind === 'background' && media[0]) return <IdleMedia media={media[0]} loop />
  if (kind === 'loop' && media.length) return <IdleLoop media={media} interval={interval} />
  return null
}

function IdleMedia({ media, loop, onEnded }: { media: { type: string; url: string }; loop: boolean; onEnded?: () => void }) {
  if (media.type === 'image') return <img className="layer media-cover" src={media.url} alt="" />
  return <video className="layer media-cover" src={media.url} autoPlay muted loop={loop} onEnded={onEnded} />
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

function LiveVideo({ content, audio }: { content: ContentLayer; audio: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const lastReport = useRef(0)

  // Play or pause when the control window says so.
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (content.playing) void video.play().catch(() => {})
    else video.pause()
  }, [content.playing])

  // Jump to a time.
  useEffect(() => {
    const video = ref.current
    if (video && content.seekId !== undefined && content.seekTo !== undefined) video.currentTime = content.seekTo
  }, [content.seekId])

  // Only the output with the sound reports the time, so there is one source of truth.
  // `always` is for play, pause, end and load; time updates are sent at most 4 times a second.
  const report = (ended: boolean, always = true) => {
    const video = ref.current
    if (!video || !audio) return
    const now = Date.now()
    if (!always && now - lastReport.current < 250) return
    lastReport.current = now
    api.reportPlayback({
      take: content.take,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      playing: !video.paused,
      ended
    })
  }

  return (
    <video
      ref={ref}
      className="layer media-contain"
      src={content.url}
      autoPlay={content.playing}
      muted={!audio}
      onTimeUpdate={() => report(false, false)}
      onPlay={() => report(false)}
      onPause={() => report(false)}
      onLoadedMetadata={() => report(false)}
      onEnded={() => report(true)}
    />
  )
}
