import { useEffect, useState } from 'react'
import type { ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { formatCountdown, useNow } from '../view/clock'
import { timerColor, timerSeconds } from '../view/StageView'

const api = window.mediaConsole

/** Stage tab (SPEC 5.6, 7): the participant countdown and messages only for the Stage screen. */
export function StageTab({ state }: { state: ServiceState }) {
  const now = useNow(250)
  const t = state.stageTimer
  const [label, setLabel] = useState(t.label)
  const [minutes, setMinutes] = useState(String(Math.round(t.duration / 60)))
  const [free, setFree] = useState('')
  useEffect(() => setLabel(t.label), [t.label])
  const seconds = timerSeconds(t, now)
  const hasStage = state.groups.some((g) => g.config.stageView)

  return (
    <div className="stage-tab">
      {!hasStage && <p className="warn small">{strings.noStageGroup}</p>}
      <span className="label-inline">{strings.timerLabel}</span>
      <div className={`timer-box is-${timerColor(seconds)}`}>
        <span className="timer-name">{t.label}</span>
        <span className="timer-time mono">{formatCountdown(seconds)}</span>
      </div>
      <form
        className="button-row tight"
        onSubmit={(e) => {
          e.preventDefault()
          void api.stageTimerSet(label, Number(minutes) * 60)
        }}
      >
        <input className="input timer-label" value={label} placeholder={strings.timerNamePlaceholder} onChange={(e) => setLabel(e.target.value)} />
        <input className="input input-num" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <span className="dim small">{strings.minutes}</span>
        <button className="btn btn-small" type="submit">
          {strings.setTime}
        </button>
      </form>
      <div className="button-row tight">
        {t.running ? (
          <button className="btn" onClick={() => void api.stageTimerPause()}>
            {strings.pause}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => void api.stageTimerStart()}>
            {strings.start}
          </button>
        )}
        <button className="btn" onClick={() => void api.stageTimerReset()}>
          {strings.reset}
        </button>
      </div>

      <span className="label-inline">{strings.stageMessagesLabel}</span>
      <div className="stage-quick">
        {strings.stageQuick.map((m) => (
          <button key={m} className={state.stageMessage === m ? 'btn btn-on' : 'btn'} onClick={() => void api.stageMessage(m)}>
            {m}
          </button>
        ))}
      </div>
      <form
        className="button-row tight"
        onSubmit={(e) => {
          e.preventDefault()
          if (free.trim()) void api.stageMessage(free).then(() => setFree(''))
        }}
      >
        <input className="input stage-free" value={free} placeholder={strings.stageFreePlaceholder} onChange={(e) => setFree(e.target.value)} />
        <button className="btn btn-small" type="submit">
          {strings.send}
        </button>
      </form>
      {state.stageMessage && (
        <div className="stage-now-msg">
          <span className="small">{strings.messageNow(state.stageMessage)}</span>
          <button className="btn btn-small btn-quiet" onClick={() => void api.stageMessage(null)}>
            {strings.removeMessage}
          </button>
        </div>
      )}
    </div>
  )
}

/** Message tab (SPEC 5.6): lower-third text (name and role, notices), saved messages, target group. */
export function MessageTab({ state }: { state: ServiceState }) {
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [target, setTarget] = useState<string>(state.groups.find((g) => !g.config.stageView)?.config.id ?? 'all')
  const targetName = target === 'all' ? strings.allScreens : (state.groups.find((g) => g.config.id === target)?.config.name ?? '')
  const liveMessage = state.groups.some((g) => g.live.text && !g.live.text.itemId && !g.live.text.ref)

  return (
    <div className="stage-tab">
      <span className="label-inline">{strings.lowerThirdLabel}</span>
      <input className="input stage-free" value={line1} placeholder={strings.line1Placeholder} onChange={(e) => setLine1(e.target.value)} />
      <input className="input stage-free" value={line2} placeholder={strings.line2Placeholder} onChange={(e) => setLine2(e.target.value)} />
      <div className="button-row tight">
        <select className="input select" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="all">{strings.allScreens}</option>
          {state.groups.map((g) => (
            <option key={g.config.id} value={g.config.id}>
              {g.config.name}
            </option>
          ))}
        </select>
        <button className="btn btn-live" disabled={!line1.trim()} onClick={() => void api.showMessage(line1, line2, target)}>
          {strings.showOn(targetName)}
        </button>
        <button className="btn" disabled={!line1.trim()} onClick={() => void api.saveMessage(line1, line2)}>
          {strings.saveMessage}
        </button>
        {liveMessage && (
          <button className="btn btn-quiet" onClick={() => void api.clearText('all')}>
            {strings.clearText}
          </button>
        )}
      </div>
      <span className="label-inline">{strings.savedMessages}</span>
      {state.messages.length === 0 && <span className="dim small">{strings.noSavedMessages}</span>}
      <div className="saved-list">
        {state.messages.map((m) => (
          <div
            key={m.id}
            className="saved-row"
            onClick={() => {
              setLine1(m.line1)
              setLine2(m.line2)
            }}
            onDoubleClick={() => void api.showMessage(m.line1, m.line2, target)}
          >
            <span className="row-title">
              {m.line1}
              {m.line2 && <span className="dim"> · {m.line2}</span>}
            </span>
            <button
              className="btn btn-small btn-quiet"
              onClick={(e) => {
                e.stopPropagation()
                void api.deleteMessage(m.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
