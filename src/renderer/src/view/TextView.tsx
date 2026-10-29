import { useLayoutEffect, useRef } from 'react'
import '@fontsource/ibm-plex-serif/500.css'
import '@fontsource/ibm-plex-serif/500-italic.css'
import type { TextLayer } from '../../../shared/types'

/**
 * Bible text on a screen. Full screen: centered verse with the reference.
 * Lower third: a dark band at the bottom, over the video.
 * Sizes are relative to the screen (cqh), so the output, the preview and the
 * small copies look the same.
 */
export function TextView({ text }: { text: TextLayer }) {
  const screen = text.screens[text.index]
  const boxRef = useRef<HTMLDivElement>(null)
  const lower = text.settings.mode === 'lower'
  const refPos = text.settings.refPosition ?? 'below'

  // Make the text as large as possible, but small enough to fit the box.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => {
      let lo = 2
      let hi = lower ? 7 : 11
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2
        box.style.setProperty('--verse-size', `${mid}cqh`)
        if (box.scrollHeight > box.clientHeight + 1) hi = mid
        else lo = mid
      }
      box.style.setProperty('--verse-size', `${lo}cqh`)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [screen?.text, screen?.second, lower, refPos])

  if (!screen) return null
  const ref = refPos !== 'hide' && <div className="verse-ref">{screen.ref}</div>

  return (
    <div className={lower ? 'layer text-layer text-lower' : 'layer text-layer text-full'}>
      <div ref={boxRef} className="text-box">
        {refPos === 'above' && ref}
        <div className="verse-text">{screen.text}</div>
        {screen.second && <div className="verse-second">{screen.second}</div>}
        {refPos === 'below' && ref}
      </div>
    </div>
  )
}
