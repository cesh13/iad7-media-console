import type { ItemSettings, Settings, ShownTextStyle, TextStyle, TextStyleKind, TextStyles } from '../shared/types'
import { shownStyle as shared } from '../shared/textStyle'
import { mediaRef, refreshMedia } from './groups'
import { saveSettings } from './settings'

/**
 * How Bible text and song text look on the screens: font, size, color and
 * what is behind the text. Saved in settings.json. A song or Bible item can
 * have its own background picture (ItemSettings.background).
 */

let settings: Settings
let notify: () => void = () => {}

export function defaultTextStyle(kind: TextStyleKind): TextStyle {
  return {
    font: kind === 'bible' ? 'serif' : 'sans',
    size: 100,
    color: '#ffffff',
    align: 'center',
    shadow: true,
    uppercase: false,
    background: 'idle',
    backgroundColor: '#14233a',
    dim: 0.45
  }
}

export function connectTextStyles(s: Settings, onChange: () => void): void {
  settings = s
  notify = onChange
  const saved = settings.textStyles
  settings.textStyles = {
    bible: { ...defaultTextStyle('bible'), ...saved?.bible },
    song: { ...defaultTextStyle('song'), ...saved?.song }
  }
  for (const style of Object.values(settings.textStyles)) if (style.backgroundMedia) refreshMedia(style.backgroundMedia)
}

export function textStyles(): TextStyles {
  return settings.textStyles!
}

function changed(): void {
  saveSettings(settings)
  notify()
}

export function setTextStyle(kind: TextStyleKind, change: Partial<Omit<TextStyle, 'backgroundMedia'>>): void {
  const style = textStyles()[kind]
  if (!style) return
  Object.assign(style, change)
  style.size = Math.max(40, Math.min(160, Math.round(style.size)))
  style.dim = Math.max(0, Math.min(0.9, style.dim))
  changed()
}

/** A picture or a video for the background. Choosing one also selects "picture or video". */
export function setTextBackground(kind: TextStyleKind, path: string): void {
  const ref = mediaRef(path)
  if (!ref || ref.type === 'audio') return
  textStyles()[kind].backgroundMedia = ref
  textStyles()[kind].background = 'media'
  changed()
}

export function resetTextStyle(kind: TextStyleKind): void {
  textStyles()[kind] = defaultTextStyle(kind)
  changed()
}

/** The style for a text layer. The item's own background is used before the style background. */
export function shownStyle(kind: TextStyleKind, itemSettings?: ItemSettings): ShownTextStyle {
  return shared(textStyles()[kind], itemSettings)
}
