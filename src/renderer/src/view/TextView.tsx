import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import '@fontsource/ibm-plex-serif/500.css'
import '@fontsource/ibm-plex-serif/500-italic.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/500-italic.css'
import type { TextLayer } from '../../../shared/types'

/**
 * Bible and song text on a screen. Full screen: centered text with the
 * reference, over the background of the text style. Lower third: a dark band
 * at the bottom, over the video.
 * Sizes are relative to the screen (cqh), so the output, the preview and the
 * small copies look the same.
 */
export function TextView({ text }: { text: TextLayer }) {
  const screen = text.screens[text.index]
  const boxRef = useRef<HTMLDivElement>(null)
  const lower = text.settings.mode === 'lower'
  const refPos = text.settings.refPosition ?? 'below'
  const style = text.style
  const scale = (style?.size ?? 100) / 100

  // Make the text as large as possible (up to the style size), but small enough to fit the box.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => {
      let lo = 1.5
      let hi = (lower ? 7 : 11) * scale
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
  }, [screen?.text, screen?.second, lower, refPos, scale, style?.font, style?.uppercase])

  if (!screen) return null
  const ref = refPos !== 'hide' && <div className="verse-ref">{screen.ref}</div>

  const classes = ['layer', 'text-layer', lower ? 'text-lower' : 'text-full']
  if (style?.font === 'sans') classes.push('font-sans')
  if (style?.align === 'left') classes.push('align-left')
  if (style && !style.shadow) classes.push('no-shadow')
  if (style?.uppercase) classes.push('upper')
  const css = { '--text-color': style?.color ?? '#ffffff', '--text-dim': String(style?.dim ?? 0.45) } as CSSProperties

  return (
    <div className={classes.join(' ')} style={css}>
      {!lower && <TextBackground text={text} />}
      <div ref={boxRef} className="text-box">
        {refPos === 'above' && ref}
        <div className="verse-text">{screen.text}</div>
        {screen.second && <div className="verse-second">{screen.second}</div>}
        {refPos === 'below' && ref}
      </div>
    </div>
  )
}

/** What is behind full-screen text: a color or a picture/video, then a dark layer so the text is easy to read. */
function TextBackground({ text }: { text: TextLayer }) {
  const style = text.style
  const kind = style?.background ?? 'idle'
  if (kind === 'black') return <div className="layer text-bg-black" />
  if (kind === 'color') return <div className="layer" style={{ background: style!.backgroundColor }} />
  const media = style?.media
  return (
    <>
      {kind === 'media' && media?.type === 'image' && <img className="layer media-cover" src={media.url} alt="" />}
      {kind === 'media' && media?.type === 'video' && <video className="layer media-cover" src={media.url} autoPlay muted loop />}
      <div className="layer text-dim" />
    </>
  )
}
