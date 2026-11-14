import { useEffect, useState } from 'react'
import { programAt, startMinutes } from '../../../shared/program'
import type { ProgramPart, ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { formatCountdown, useNow } from '../view/clock'

const api = window.mediaConsole

/**
 * The program of the service (Stage drawer): parts by start time, for example
 * 9:10 Prayer. Each part ends when the next one starts. The Stage screen shows
 * the part that runs now, the time left and the next part. It follows the clock only.
 */
export function ProgramEditor({ state }: { state: ServiceState }) {
  const now = useNow(1000)
  const saved = state.service.program ?? []
  // Rows are edited here and saved when a field loses focus (the list is sorted by time on save).
  const [rows, setRows] = useState<ProgramPart[]>(saved)
  const savedKey = JSON.stringify(saved)
  useEffect(() => setRows(saved), [savedKey])
  const { current } = programAt(saved, now)
  const template = state.programTemplate

  const save = (list: ProgramPart[]) => void api.setProgram(list.filter((p) => p.title.trim() || p.start))
  const change = (id: string, patch: Partial<ProgramPart>) => setRows(rows.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const addPart = () => {
    // The new part starts 15 minutes after the last one.
    const last = rows.length ? startMinutes(rows[rows.length - 1].start) : null
    const minutes = last === null ? 9 * 60 : Math.min(23 * 60 + 59, last + 15)
    const start = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    setRows([...rows, { id: crypto.randomUUID(), start, title: '' }])
  }

  return (
    <div className="drawer-col program-editor">
      <div className="program-head">
        <span className="label-inline">{strings.programLabel}</span>
        <div className="spacer" />
        <button
          className="btn btn-small btn-quiet"
          title={strings.useTemplateHint}
          disabled={template.length === 0}
          onClick={() => void api.useProgramTemplate()}
        >
          {strings.useTemplate}
        </button>
        <button
          className="btn btn-small btn-quiet"
          title={strings.saveTemplateHint}
          disabled={saved.length === 0}
          onClick={() => void api.saveProgramTemplate()}
        >
          {strings.saveTemplate}
        </button>
      </div>
      {rows.length === 0 && <p className="dim small">{strings.programEmpty}</p>}
      <div className="program-list">
        {rows.map((p) => (
          <div key={p.id} className={current?.id === p.id ? 'program-row is-now' : 'program-row'}>
            <input
              className="input program-time mono"
              type="time"
              value={p.start}
              aria-label={strings.programStart}
              onChange={(e) => change(p.id, { start: e.target.value })}
              onBlur={() => save(rows)}
            />
            <input
              className="input program-title"
              value={p.title}
              placeholder={strings.programTitlePlaceholder}
              onChange={(e) => change(p.id, { title: e.target.value })}
              onBlur={() => save(rows)}
            />
            <input
              className="input program-who"
              value={p.who ?? ''}
              placeholder={strings.programWhoPlaceholder}
              onChange={(e) => change(p.id, { who: e.target.value })}
              onBlur={() => save(rows)}
            />
            <button
              className="btn btn-small btn-quiet"
              title={strings.programRemove}
              aria-label={strings.programRemove}
              onClick={() => save(rows.filter((x) => x.id !== p.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="button-row tight">
        <button className="btn btn-small" onClick={addPart}>
          + {strings.programAdd}
        </button>
      </div>
    </div>
  )
}

/** Bottom bar: the part of the program that runs now and its time left. Hidden without a program. */
export function ProgramStatus({ state }: { state: ServiceState }) {
  const now = useNow(1000)
  const parts = state.service.program ?? []
  if (parts.length === 0) return null
  const { current, endsAt, next, nextAt } = programAt(parts, now)
  if (!current && next && nextAt)
    return (
      <span className="program-status dim" title={strings.programLabel}>
        {strings.programStartsAt(next.title, next.start)}
      </span>
    )
  if (!current) return null
  const left = endsAt ? (endsAt - now) / 1000 : null
  return (
    <span className={left !== null && left <= 5 * 60 ? 'program-status is-warn' : 'program-status'} title={strings.programLabel}>
      <span className="program-status-title">{current.title}</span>
      {left !== null && <span className="mono">{strings.programLeft(formatCountdown(left).replace('+', ''))}</span>}
    </span>
  )
}
