import { useState, type FormEvent } from 'react'
import type { PresetInfo, PresetSummary, ServiceState } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

/**
 * Save this service as a preset, or (with `preset`) edit the name, days and
 * time of a preset. The keys stay inside this window: Space or Enter here must
 * never reach the live controls of the main page.
 */
export function PresetDialog({ state, preset, onClose }: { state: ServiceState; preset?: PresetSummary; onClose: () => void }) {
  const editing = !!preset
  // A service that came from a preset starts with that preset, so saving updates it.
  const first = preset ?? state.presets.find((p) => p.id === state.service.presetId)
  const [name, setName] = useState(first?.name ?? '')
  const [days, setDays] = useState<number[]>(first?.days ?? [])
  const [time, setTime] = useState(first?.time ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const findOther = (text: string) =>
    state.presets.find((p) => p.id !== preset?.id && p.name.toLowerCase() === text.trim().toLowerCase())
  const other = findOther(name)
  const canSave = !!name.trim() && !(editing && other)

  const changeName = (text: string) => {
    setName(text)
    const match = editing ? undefined : findOther(text)
    if (match) {
      setDays(match.days)
      setTime(match.time)
    }
  }

  const toggleDay = (day: number) => setDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    const info: PresetInfo = { name, days, time }
    await (preset ? api.updatePreset(preset.id, info) : api.saveAsPreset(info))
    onClose()
  }

  const remove = async () => {
    if (!preset) return
    await api.deletePreset(preset.id)
    onClose()
  }

  return (
    <div
      className="dialog-backdrop"
      onClick={onClose}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') onClose()
      }}
    >
      {/* tabIndex: a click on an empty part of this window keeps the keys inside it. */}
      <form className="dialog preset-dialog" tabIndex={-1} onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <div className="dialog-head">
          <h2 className="bible-title">{editing ? strings.presetEditTitle : strings.presetSaveTitle}</h2>
          <div className="spacer" />
          <button type="button" className="btn btn-small btn-quiet" onClick={onClose}>
            ✕
          </button>
        </div>
        {!editing && <p className="help small">{strings.presetSaveHelp(state.service.items.length)}</p>}

        <label className="preset-field">
          <span className="label-inline">{strings.presetName}</span>
          <input className="input" value={name} autoFocus placeholder={strings.presetNamePlaceholder} onChange={(e) => changeName(e.target.value)} />
        </label>
        {other && <p className="warn small">{editing ? strings.presetNameTaken : strings.presetReplaceNote(other.name)}</p>}

        <div className="preset-field">
          <span className="label-inline">{strings.presetDays}</span>
          <div className="chips">
            {strings.weekdays.map((label, day) => (
              <button key={label} type="button" className={days.includes(day) ? 'chip is-on' : 'chip'} onClick={() => toggleDay(day)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="preset-field">
          <span className="label-inline">{strings.presetTime}</span>
          <input className="input preset-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <p className="help small">{strings.presetScheduleHelp}</p>

        <div className="preset-actions">
          {editing && (
            <button type="button" className={confirmDelete ? 'btn btn-live' : 'btn btn-quiet'} onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}>
              {confirmDelete ? strings.presetDeleteConfirm : strings.presetDelete}
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {strings.presetCancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            {!editing && other ? strings.presetReplace : strings.presetSave}
          </button>
        </div>
      </form>
    </div>
  )
}
