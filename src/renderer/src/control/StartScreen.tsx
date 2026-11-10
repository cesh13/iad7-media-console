import { useEffect, useRef, useState } from 'react'
import { localDate, recommendedPreset } from '../../../shared/presets'
import type { PresetSummary, ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { PresetDialog } from './PresetDialog'

const api = window.mediaConsole

/** Start screen (SPEC 5.7): continue the last service, or start a new one from a preset. */
export function StartScreen({ state, onClose }: { state: ServiceState; onClose: () => void }) {
  const [editing, setEditing] = useState<PresetSummary | null>(null)
  const [now] = useState(() => new Date())
  const leaving = useRef(false)

  const recommended = recommendedPreset(state.presets, now)
  const anyLive = state.groups.some((g) => g.live.content || g.live.text)
  // Enter must never take something off the screens, and a restart on the same day returns to the same service.
  const enterContinues = anyLive || !recommended || state.service.date === localDate(now)
  const recent = state.services.filter((s) => s.id !== state.service.id).slice(0, 5)

  /** Only one choice counts, also if Enter or a button is pressed twice. */
  const leaveWith = async (open?: () => Promise<void>) => {
    if (leaving.current) return
    leaving.current = true
    await open?.()
    onClose()
  }
  const startRecommended = () => recommended && void leaveWith(() => api.startPreset(recommended.id))

  // Enter when no button has the focus. A focused button handles Enter by itself.
  // Space is not used here, because presenter clickers can send it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.target !== document.body || editing) return
      e.preventDefault()
      if (enterContinues) void leaveWith()
      else startRecommended()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, enterContinues, recommended?.id])

  const schedule = (p: PresetSummary) =>
    [p.days.map((d) => strings.weekdays[d]).join(', '), p.time].filter(Boolean).join(' · ') || strings.presetNoSchedule

  return (
    <div className="start-screen">
      <div className="start-panel">
        <header className="start-head">
          <h1 className="start-title">{strings.appName}</h1>
          <span className="dim">{now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </header>

        <section className="start-section">
          <h2 className="label-inline">{strings.startContinue}</h2>
          <button className={enterContinues ? 'start-card is-default' : 'start-card'} onClick={() => void leaveWith()}>
            <span className="start-card-name">{state.service.name}</span>
            <span className="dim small">{anyLive ? strings.startLiveNow : strings.presetItems(state.service.items.length)}</span>
            {enterContinues && <kbd className="start-key">Enter</kbd>}
          </button>
        </section>

        <section className="start-section">
          <h2 className="label-inline">{strings.startPresets}</h2>
          {anyLive && <p className="warn small">{strings.startLiveWarning}</p>}
          {state.presets.length === 0 && <p className="help small">{strings.startNoPresets}</p>}
          <div className="start-presets">
            {state.presets.map((p) => {
              const isRecommended = p.id === recommended?.id
              return (
                <div key={p.id} className="start-preset">
                  <button
                    className={['start-card', isRecommended ? 'is-suggested' : '', isRecommended && !enterContinues ? 'is-default' : ''].join(' ')}
                    onClick={() => void leaveWith(() => api.startPreset(p.id))}
                  >
                    <span className="start-card-name">{p.name}</span>
                    <span className="dim small">{schedule(p)}</span>
                    <span className="dim small">{strings.presetItems(p.items)}</span>
                    {isRecommended && <span className="start-badge">{strings.startSuggested}</span>}
                    {isRecommended && !enterContinues && <kbd className="start-key">Enter</kbd>}
                  </button>
                  <button className="btn btn-small btn-quiet start-preset-edit" title={strings.presetEditHint} onClick={() => setEditing(p)}>
                    ✎
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {recent.length > 0 && (
          <section className="start-section">
            <h2 className="label-inline">{strings.startRecent}</h2>
            <div className="start-recent">
              {recent.map((s) => (
                <button key={s.id} className="start-recent-row" onClick={() => void leaveWith(() => api.openService(s.id))}>
                  <span>{s.name}</span>
                  <span className="dim small">{strings.presetItems(s.items)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <button className="btn btn-quiet start-empty" onClick={() => void leaveWith(api.newService)}>
          + {strings.startEmpty}
        </button>
      </div>
      {editing && <PresetDialog state={state} preset={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
