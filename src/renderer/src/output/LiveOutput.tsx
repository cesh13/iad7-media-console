import { useEffect, useRef, useState } from 'react'
import type { OutputRender } from '../../../shared/types'

const api = window.mediaConsole

/** A real output window. It shows only what the main process sends. */
export function LiveOutput() {
  const [render, setRender] = useState<OutputRender | null>(null)
  useEffect(() => api.onOutputRender(setRender), [])

  const live = render?.live
  // Nothing live: black. Idle screens (logo, background) come in step 3.
  if (!live) return <div className="live" />

  return (
    <div className="live">
      {live.type === 'image' && <img key={live.take} className="live-media" src={live.url} alt="" />}
      {live.type === 'video' && <LiveVideo key={live.take} render={render!} />}
    </div>
  )
}

function LiveVideo({ render }: { render: OutputRender }) {
  const live = render.live!
  const ref = useRef<HTMLVideoElement>(null)
  const lastReport = useRef(0)

  // Play or pause when the control window says so.
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (live.playing) void video.play().catch(() => {})
    else video.pause()
  }, [live.playing])

  // Jump to a time.
  useEffect(() => {
    const video = ref.current
    if (video && live.seekId !== undefined && live.seekTo !== undefined) video.currentTime = live.seekTo
  }, [live.seekId])

  // Only the output with sound reports the time, so there is one source of truth.
  // `always` is for play, pause, end and load; time updates are sent at most 4 times a second.
  const report = (ended: boolean, always = true) => {
    const video = ref.current
    if (!video || !render.audio) return
    const now = Date.now()
    if (!always && now - lastReport.current < 250) return
    lastReport.current = now
    api.reportPlayback({
      take: live.take,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      playing: !video.paused,
      ended
    })
  }

  return (
    <video
      ref={ref}
      className="live-media"
      src={live.url}
      autoPlay={live.playing}
      muted={!render.audio}
      onTimeUpdate={() => report(false, false)}
      onPlay={() => report(false)}
      onPause={() => report(false)}
      onLoadedMetadata={() => report(false)}
      onEnded={() => report(true)}
    />
  )
}
