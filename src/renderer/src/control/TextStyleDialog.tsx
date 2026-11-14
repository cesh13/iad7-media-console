import { useEffect, useState } from 'react'
import { shownStyle } from '../../../shared/textStyle'
import type { OutputRender, ServiceState, TextBackground, TextLayer, TextStyle, TextStyleKind } from '../../../shared/types'
import { strings } from '../strings'
import { ScreenView } from '../view/ScreenView'

const api = window.mediaConsole
const noOverlays = { black: false, logo: false }
const backgrounds: TextBackground[] = ['idle', 'black', 'color', 'media']

/** The idle screen of the target group (or the first group), so the preview shows the real background. */
export function previewIdle(state: ServiceState): OutputRender['idle'] {
  const group = state.groups.find((g) => g.config.id === state.target && !g.config.stageView) ?? state.groups.find((g) => !g.config.stageView)
  const config = group?.config
  if (!config) return { kind: 'black', media: [], interval: 8 }
  return {
    kind: config.idle,
    media: config.idleMedia
      .filter((m) => m.url && m.type !== 'audio')
      .map((m) => ({ type: m.type as 'image' | 'video', url: m.url! })),
    interval: config.idleInterval
  }
}

/**
 * Text style window: how Bible text and song text look on the screens (font,
 * size, color, background). Changes are saved and show on the screens at once.
 */
export function TextStyleDialog({ state, kind: firstKind, onClose }: { state: ServiceState; kind: TextStyleKind; onClose: () => void }) {
  const [kind, setKind] = useState<TextStyleKind>(firstKind)
  const style = state.textStyles[kind]
  const set = (change: Partial<Omit<TextStyle, 'backgroundMedia'>>) => void api.setTextStyle(kind, change)

  // Esc closes this window only: it must not also clear the screens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const sample = strings.styleSamples[kind]
  const preview: TextLayer = {
    itemId: null,
    take: -1,
    title: '',
    screens: [{ text: sample.text, ref: sample.ref, label: '', verse: 1 }],
    index: 0,
    settings: { autoDone: false, mode: 'full', refPosition: kind === 'bible' ? 'below' : 'hide' },
    style: shownStyle(style)
  }
  const mediaName = style.backgroundMedia?.path.split(/[\\/]/).pop()

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog text-style-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 className="bible-title">{strings.textStyleTitle}</h2>
          <div className="spacer" />
          <button className="btn btn-small btn-quiet" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="chips">
          {(['bible', 'song'] as const).map((k) => (
            <button key={k} className={kind === k ? 'chip is-on' : 'chip'} onClick={() => setKind(k)}>
              {strings.styleKinds[k]}
            </button>
          ))}
        </div>
        <p className="help small">{strings.styleKindHelp[kind]}</p>

        <div className="text-style-body">
          <div className="text-style-preview">
            <ScreenView content={null} text={preview} idle={previewIdle(state)} overlays={noOverlays} />
          </div>

          <div className="text-style-options">
            <div className="option">
              <span className="label-inline">{strings.styleFont}</span>
              <div className="chips">
                {(['serif', 'sans'] as const).map((f) => (
                  <button key={f} className={style.font === f ? 'chip is-on' : 'chip'} onClick={() => set({ font: f })}>
                    {strings.styleFonts[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="option">
              <span className="label-inline">{strings.styleSize}</span>
              <div className="button-row tight">
                <input type="range" min={40} max={160} step={5} value={style.size} onChange={(e) => set({ size: Number(e.target.value) })} />
                <span className="mono">{style.size}%</span>
              </div>
              <span className="dim small">{strings.styleSizeHelp}</span>
            </div>

            <div className="option">
              <span className="label-inline">{strings.styleColor}</span>
              <div className="button-row tight">
                <input type="color" className="color-input" value={style.color} onChange={(e) => set({ color: e.target.value })} />
                {['#ffffff', '#fff3c4', '#ffd166', '#cfe8ff'].map((c) => (
                  <button key={c} className="swatch" style={{ background: c }} title={c} onClick={() => set({ color: c })} />
                ))}
              </div>
            </div>

            <div className="option">
              <span className="label-inline">{strings.styleAlign}</span>
              <div className="chips">
                {(['center', 'left'] as const).map((a) => (
                  <button key={a} className={style.align === a ? 'chip is-on' : 'chip'} onClick={() => set({ align: a })}>
                    {strings.styleAligns[a]}
                  </button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={style.shadow} onChange={(e) => set({ shadow: e.target.checked })} />
                {strings.styleShadow}
              </label>
              <label className="check">
                <input type="checkbox" checked={style.uppercase} onChange={(e) => set({ uppercase: e.target.checked })} />
                {strings.styleUppercase}
              </label>
            </div>

            <div className="option">
              <span className="label-inline">{strings.styleBackground}</span>
              <div className="chips">
                {backgrounds.map((b) => (
                  <button
                    key={b}
                    className={style.background === b ? 'chip is-on' : 'chip'}
                    onClick={() => (b === 'media' && !style.backgroundMedia ? void api.pickTextBackground(kind) : set({ background: b }))}
                  >
                    {strings.styleBackgrounds[b]}
                  </button>
                ))}
              </div>
              {style.background === 'idle' && <span className="dim small">{strings.styleIdleHelp}</span>}
              {style.background === 'color' && (
                <input
                  type="color"
                  className="color-input"
                  value={style.backgroundColor}
                  onChange={(e) => set({ backgroundColor: e.target.value })}
                />
              )}
              {style.background === 'media' && (
                <div className="button-row tight">
                  <span className="mono small path">{mediaName ?? '…'}</span>
                  <button className="btn btn-small" onClick={() => void api.pickTextBackground(kind)}>
                    {strings.chooseFile}
                  </button>
                </div>
              )}
              {(style.background === 'idle' || style.background === 'media') && (
                <div className="button-row tight">
                  <span className="label-inline">{strings.styleDim}</span>
                  <input type="range" min={0} max={0.9} step={0.05} value={style.dim} onChange={(e) => set({ dim: Number(e.target.value) })} />
                  <span className="mono">{Math.round(style.dim * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="button-row">
          <span className="dim small">{strings.styleLiveNote}</span>
          <div className="spacer" />
          <button className="btn btn-quiet" onClick={() => void api.resetTextStyle(kind)}>
            {strings.styleReset}
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            {strings.done}
          </button>
        </div>
      </div>
    </div>
  )
}
