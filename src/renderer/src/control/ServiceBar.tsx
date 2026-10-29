import { useEffect, useState } from 'react'
import type { ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { formatClock, formatCountdown, useNow } from '../view/clock'

const api = window.mediaConsole

/** Top bar (SPEC 5.1): clock, and time since the service started. */
export function ServiceClock({ state }: { state: ServiceState }) {
  const now = useNow(1000)
  const started = state.service.startedAt
  return (
    <div className="service-clock">
      <span className="mono clock">{formatClock(now)}</span>
      <span className="mono dim elapsed" title={strings.elapsedHint}>
        {started ? formatCountdown(-(now - started) / 1000).replace('+', '') : '0:00'}
      </span>
    </div>
  )
}

/** Bottom bar (SPEC 5.6): the loaded service, with rename and "+ New". */
export function ServiceBar({ state }: { state: ServiceState }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.service.name)
  useEffect(() => setName(state.service.name), [state.service.name])

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
    </div>
  )
}

/**
 * Hotkeys F1–F8 (SPEC 5.6): one press = live now. Only keys that have a
 * favorite show. "+" opens Library › ★ Favorites, where they are edited.
 */
export function HotkeysBar({ state, onEdit }: { state: ServiceState; onEdit: () => void }) {
  const keys = state.favorites.filter((f) => f.hotkey).sort((a, b) => (a.hotkey ?? 0) - (b.hotkey ?? 0))
  return (
    <div className="hotkeys">
      {keys.length === 0 && <span className="dim small">{strings.noHotkeys}</span>}
      {keys.map((f) => {
        const on = (f.kind === 'logo' && state.overlays.logo) || (f.kind === 'black' && state.overlays.black)
        return (
          <button
            key={f.id}
            className={on ? 'hotkey is-on' : 'hotkey'}
            title={f.path ?? f.title}
            onClick={() => void api.triggerHotkey(f.hotkey!)}
          >
            <span className="mono hotkey-key">F{f.hotkey}</span>
            <span className="hotkey-title">{f.title}</span>
          </button>
        )
      })}
      <button className="btn btn-small btn-quiet hotkey-edit" title={strings.editHotkeys} onClick={onEdit}>
        +
      </button>
    </div>
  )
}
