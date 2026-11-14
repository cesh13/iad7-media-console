import type { ItemSettings, ShownTextStyle, TextStyle } from './types'

/**
 * The style that a text layer uses: the saved style, with the item's own
 * background picture or video if it has one. Used by the main process (live
 * text) and by the previews, so both look the same.
 */
export function shownStyle(style: TextStyle, itemSettings?: ItemSettings): ShownTextStyle {
  const own = itemSettings?.background
  if (own?.url && own.type !== 'audio') return { ...style, background: 'media', media: { type: own.type, url: own.url } }
  const m = style.backgroundMedia
  const media = m?.url && m.type !== 'audio' ? { type: m.type, url: m.url } : undefined
  // "Picture or video" without a file that is ready: use the idle background.
  if (style.background === 'media' && !media) return { ...style, background: 'idle' }
  return { ...style, media }
}
