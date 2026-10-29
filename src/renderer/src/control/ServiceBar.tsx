import { useEffect, useState } from 'react'
import type { ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { formatClock, formatCountdown, useNow } from '../view/clock'

const api = window.mediaConsole

/** Top bar (SPEC 5.1): service selector, clock, and time since the service started. */
export function ServiceBar({ state }: { state: ServiceState }) {
  const now = useNow(1000)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.service.name)
  useEffect(() => setName(state.service.name), [state.service.name])
  const started = state.service.startedAt

  const save = () => {
    setEditing(false)
    if (name.trim() && name !== state.service.name) void api.renameService(name)
  }

  return (
    <div className="service-bar">
      <span className="dim">{strings.serviceLabel}</span>
      {editing ? (
        <input
          className="input service-name-input"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <select
          className="input select service-select"
          value={state.service.id}
          onChange={(e) => void api.openService(e.target.value)}
          onDoubleClick={() => setEditing(true)}
          title={strings.renameHint}
        >
          {/* The current service is always in the list, also before its first save. */}
          {!state.services.some((s) => s.id === state.service.id) && <option value={state.service.id}>{state.service.name}</option>}
          {state.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <button className="btn btn-small btn-quiet" title={strings.renameService} onClick={() => setEditing(true)}>
        ✎
      </button>
      <button className="btn btn-small btn-quiet" onClick={() => void api.newService()}>
        + {strings.newService}
      </button>
      <span className="mono clock">{formatClock(now)}</span>
      <span className="mono dim elapsed" title={strings.elapsedHint}>
        {started ? formatCountdown(-(now - started) / 1000).replace('+', '') : '0:00'}
      </span>
    </div>
  )
}

/** Hotkeys F1–F8 (SPEC 5.6): one press = live now. Edited in Library › ★ Favorites. */
export function HotkeysBar({ state }: { state: ServiceState }) {
  return (
    <div className="hotkeys">
      <span className="label-inline">{strings.hotkeysLabel}</span>
      <div className="hotkey-grid">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((key) => {
          const f = state.favorites.find((x) => x.hotkey === key)
          const on = (f?.kind === 'logo' && state.overlays.logo) || (f?.kind === 'black' && state.overlays.black)
          return (
            <button
              key={key}
              className={on ? 'hotkey is-on' : 'hotkey'}
              disabled={!f}
              title={f?.path ?? f?.title}
              onClick={() => void api.triggerHotkey(key)}
            >
              <span className="mono hotkey-key">F{key}</span>
              <span className="hotkey-title">{f?.title ?? strings.emptyHotkey}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
