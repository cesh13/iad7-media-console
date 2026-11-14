import { useEffect, useState } from 'react'
import type { OutputRender } from '../../../shared/types'
import { ScreenView } from '../view/ScreenView'
import { StageView } from '../view/StageView'

const api = window.mediaConsole

/** A real output window. It shows only what the main process sends. */
export function LiveOutput() {
  const [render, setRender] = useState<OutputRender | null>(null)
  useEffect(() => api.onOutputRender(setRender), [])

  if (!render) return <div className="screen-view" />
  // Stage view groups show the stage layout (the sound of videos stays on the main screens).
  if (render.stage) return <StageView stage={render.stage} />

  const audio = !!render.content && render.audioTakes.includes(render.content.take)
  return (
    <ScreenView
      content={render.content}
      text={render.text}
      idle={render.idle}
      logoUrl={render.logoUrl}
      overlays={render.overlays}
      audio={audio}
      itemsVolume={render.itemsVolume}
      audioDevice={render.audioDevice}
      // Only the output with the sound reports the time, so there is one source of truth.
      onPlayback={audio ? (r) => api.reportPlayback(r) : undefined}
    />
  )
}
