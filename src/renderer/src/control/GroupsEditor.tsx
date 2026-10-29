import { useEffect, useState } from 'react'
import type { GroupConfig, IdleKind, ScreensState } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

const idleKinds: IdleKind[] = ['black', 'logo', 'background', 'loop']

/** "Edit groups": screens per group, idle screen per group, and the church logo. */
export function GroupsEditor({ state }: { state: ScreensState }) {
  const [newName, setNewName] = useState('')
  const grouped = new Set(state.groups.flatMap((g) => g.outputIds))
  const ungrouped = state.outputs.filter((o) => !grouped.has(o.output.id))

  return (
    <section className="panel">
      <h2 className="label">{strings.groupsLabel}</h2>
      <p className="help">{strings.groupsHelp}</p>

      <div className="logo-row">
        <div className="logo-thumb">{state.logo?.url && <img src={state.logo.url} alt="" />}</div>
        <div>
          <div className="screen-title">{strings.logoLabel}</div>
          <div className="mono dim">{state.logo?.path ?? strings.noLogo}</div>
        </div>
        <button className="btn" onClick={() => void api.pickLogo()}>
          {strings.chooseLogo}
        </button>
      </div>

      {ungrouped.length > 0 && (
        <div className="panel-warn ungrouped">
          {ungrouped.map((o) => (
            <div key={o.output.id} className="ungrouped-row">
              <span className="dot dot-warn" />
              <span className="missing-name">{o.output.name}</span>
              <span className="dim">{strings.notInGroup}</span>
              <select
                className="input select"
                value=""
                onChange={(e) => void api.assignOutput(o.output.id, e.target.value || null)}
              >
                <option value="">{strings.addToGroup}</option>
                {state.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="group-list">
        {state.groups.map((g) => (
          <GroupEditor key={g.id} group={g} state={state} canRemove={state.groups.length > 1} />
        ))}
      </div>

      <form
        className="screen-form add-group"
        onSubmit={(e) => {
          e.preventDefault()
          void api.addGroup(newName).then(() => setNewName(''))
        }}
      >
        <input
          className="input"
          value={newName}
          placeholder={strings.newGroupPlaceholder}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="btn" type="submit">
          + {strings.addGroup}
        </button>
      </form>
    </section>
  )
}

function GroupEditor({ group, state, canRemove }: { group: GroupConfig; state: ScreensState; canRemove: boolean }) {
  const [name, setName] = useState(group.name)
  useEffect(() => setName(group.name), [group.name])
  const saveName = () => {
    if (name.trim() && name.trim() !== group.name) void api.updateGroup(group.id, { name })
  }
  const needsMedia = (group.idle === 'background' || group.idle === 'loop') && group.idleMedia.length === 0
  const needsLogo = group.idle === 'logo' && !state.logo

  return (
    <div className="group-editor">
      <div className="group-editor-head">
        <input
          className="input group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && saveName()}
        />
        <button className="btn btn-quiet" disabled={!canRemove} onClick={() => void api.removeGroup(group.id)}>
          {strings.removeGroup}
        </button>
      </div>

      <div className="group-field">
        <span className="label-inline">{strings.groupScreens}</span>
        <div className="chips">
          {state.outputs.length === 0 && <span className="dim">{strings.noOutputsShort}</span>}
          {state.outputs.map((o) => {
            const inGroup = group.outputIds.includes(o.output.id)
            return (
              <button
                key={o.output.id}
                className={inGroup ? 'chip is-on' : 'chip'}
                onClick={() => void api.assignOutput(o.output.id, inGroup ? null : group.id)}
              >
                {inGroup ? '✓ ' : '+ '}
                {o.output.name}
                {!o.screen && ` (${strings.notConnected})`}
              </button>
            )
          })}
        </div>
      </div>

      <div className="group-field">
        <span className="label-inline">{strings.idleLabel}</span>
        <div className="chips">
          {idleKinds.map((k) => (
            <button
              key={k}
              className={group.idle === k ? 'chip is-on' : 'chip'}
              onClick={() => void api.updateGroup(group.id, { idle: k })}
            >
              {strings.idleKinds[k]}
            </button>
          ))}
        </div>
      </div>

      {(group.idle === 'background' || group.idle === 'loop') && (
        <div className="group-field">
          <span className="label-inline">{strings.idleFiles}</span>
          <div className="idle-files">
            {group.idleMedia.map((m) => (
              <span key={m.path} className="mono idle-file">
                {m.path.split(/[\\/]/).pop()}
                {!m.url && ` (${strings.copying(0)})`}
              </span>
            ))}
            <button className="btn btn-small" onClick={() => void api.pickIdleMedia(group.id)}>
              {strings.chooseFiles}
            </button>
            {group.idleMedia.length > 0 && (
              <button className="btn btn-small btn-quiet" onClick={() => void api.clearIdleMedia(group.id)}>
                {strings.clearFiles}
              </button>
            )}
          </div>
        </div>
      )}

      {group.idle === 'loop' && (
        <div className="group-field">
          <span className="label-inline">{strings.idleInterval}</span>
          <input
            className="input input-num"
            type="number"
            min={1}
            value={group.idleInterval}
            onChange={(e) => void api.updateGroup(group.id, { idleInterval: Number(e.target.value) })}
          />
        </div>
      )}

      {(needsMedia || needsLogo) && <p className="warn idle-warn">{needsLogo ? strings.idleNeedsLogo : strings.idleNeedsFiles}</p>}
    </div>
  )
}
