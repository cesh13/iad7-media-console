import { useEffect, useState } from 'react'
import type { OutputRender } from '../../../shared/types'
import { ScreenView } from '../view/ScreenView'

const api = window.mediaConsole

/** A real output window. It shows only what the main process sends. */
export function LiveOutput() {
  const [render, setRender] = useState<OutputRender | null>(null)
  useEffect(() => api.onOutputRender(setRender), [])

  if (!render) return <div className="screen-view" />

  const audio = !!render.content && render.audioTakes.includes(render.content.take)
  return (
    <ScreenView
      content={render.content}
      idle={render.idle}
      logoUrl={render.logoUrl}
      overlays={render.overlays}
      audio={audio}
      // Only the output with the sound reports the time, so there is one source of truth.
      onPlayback={audio ? (r) => api.reportPlayback(r) : undefined}
    />
  )
}
