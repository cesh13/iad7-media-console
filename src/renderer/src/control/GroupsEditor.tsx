import { useEffect, useRef, useState } from 'react'
import type { GroupConfig, IdleKind, ScreensState } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

const idleKinds: IdleKind[] = ['black', 'logo', 'background', 'loop']

/** "Edit groups": what each group shows (service or stage view), and its idle screen. */
export function GroupsEditor({ state }: { state: ScreensState }) {
  // The ids before "Add group", so the new group can be found when the state comes back.
  const [idsBefore, setIdsBefore] = useState<string[] | null>(null)
  const [newId, setNewId] = useState<string | null>(null)

  useEffect(() => {
    if (!idsBefore) return
    const added = state.groups.find((g) => !idsBefore.includes(g.id))
    if (added) {
      setNewId(added.id)
      setIdsBefore(null)
    }
  }, [state.groups])

  /** Add a group with a default name ("Group 3"). The name can be changed in its card. */
  const addGroup = () => {
    const names = new Set(state.groups.map((g) => g.name))
    let n = state.groups.length + 1
    while (names.has(strings.defaultGroupName(n))) n++
    setIdsBefore(state.groups.map((g) => g.id))
    void api.addGroup(strings.defaultGroupName(n))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="label">{strings.groupsLabel}</h2>
        <button className="btn" onClick={addGroup}>
          + {strings.addGroup}
        </button>
      </div>
      <p className="help">{strings.groupsHelp}</p>

      <div className="group-list">
        {state.groups.map((g) => (
          <GroupEditor
            key={g.id}
            group={g}
            state={state}
            canRemove={state.groups.length > 1}
            isNew={g.id === newId}
          />
        ))}
      </div>
    </section>
  )
}

/** The church logo. One logo for the whole app: the Logo button and groups with the "Logo" idle screen use it. */
export function LogoSection({ state }: { state: ScreensState }) {
  return (
    <section className="panel">
      <h2 className="label">{strings.logoLabel}</h2>
      <div className="logo-row">
        <div className="logo-thumb">{state.logo?.url && <img src={state.logo.url} alt="" />}</div>
        <div className="logo-info">
          <div className="mono" title={state.logo?.path}>
            {state.logo ? state.logo.path.split(/[\\/]/).pop() : strings.noLogo}
          </div>
          <div className="dim small">{strings.logoHelp}</div>
        </div>
        <button className="btn" onClick={() => void api.pickLogo()}>
          {strings.chooseLogo}
        </button>
      </div>
    </section>
  )
}

function GroupEditor(props: { group: GroupConfig; state: ScreensState; canRemove: boolean; isNew: boolean }) {
  const { group, state, canRemove, isNew } = props
  const [name, setName] = useState(group.name)
  useEffect(() => setName(group.name), [group.name])
  const nameRef = useRef<HTMLInputElement>(null)
  // A new group: put the cursor in its name, with the default name selected, ready to type over.
  useEffect(() => {
    if (!isNew) return
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [isNew])
  const saveName = () => {
    if (name.trim() && name.trim() !== group.name) void api.updateGroup(group.id, { name })
  }
  const stage = !!group.stageView
  const needsMedia = (group.idle === 'background' || group.idle === 'loop') && group.idleMedia.length === 0
  const needsLogo = group.idle === 'logo' && !state.logo
  // The screens of this group, with the same numbers as the screen cards above.
  const members = state.outputs
    .filter((o) => group.outputIds.includes(o.output.id))
    .map((o) => ({
      id: o.output.id,
      name: o.output.name,
      num: o.screen ? state.screens.findIndex((s) => s.electronId === o.screen!.electronId) + 1 : null
    }))

  return (
    <div className="group-editor">
      <div className="group-editor-head">
        <input
          className="input group-name"
          value={name}
          ref={nameRef}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && saveName()}
        />
        {canRemove && (
          <button
            className="btn btn-quiet"
            title={strings.removeGroup}
            aria-label={strings.removeGroup}
            onClick={() => void api.removeGroup(group.id)}
          >
            ×
          </button>
        )}
      </div>
      <div className="group-field">
        <span className="label-inline">{strings.groupScreens}</span>
        <div className="chips">
          {members.length === 0 && <span className="dim small">{strings.groupNoScreensPick}</span>}
          {members.map((m) => (
            <span key={m.id} className={m.num ? 'screen-tag' : 'screen-tag is-missing'}>
              <span className="screen-tag-num mono">{m.num ?? '?'}</span>
              {m.name}
              {!m.num && ` (${strings.notConnected})`}
            </span>
          ))}
        </div>
      </div>

      <div className="group-field">
        <span className="label-inline">{strings.groupShows}</span>
        <div className="chips">
          <button
            className={stage ? 'chip' : 'chip is-on'}
            onClick={() => void api.updateGroup(group.id, { stageView: false })}
          >
            {strings.showsService}
          </button>
          <button
            className={stage ? 'chip is-on' : 'chip'}
            title={strings.stageViewHelp}
            onClick={() => void api.updateGroup(group.id, { stageView: true })}
          >
            {strings.stageViewLabel}
          </button>
        </div>
      </div>

      {stage && <p className="dim small group-note">{strings.stageViewHelp}</p>}
      {stage && (
        <div className="group-field">
          <span className="label-inline">{strings.programLabel}</span>
          <label className="check">
            <input
              type="checkbox"
              checked={group.showProgram !== false}
              onChange={(e) => void api.updateGroup(group.id, { showProgram: e.target.checked })}
            />
            {strings.showProgram}
          </label>
        </div>
      )}

      {!stage && (
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
      )}

      {!stage && (group.idle === 'background' || group.idle === 'loop') && (
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
              {group.idleMedia.length ? strings.changeFiles : strings.chooseFiles}
            </button>
            {group.idleMedia.length > 0 && (
              <button className="btn btn-small btn-quiet" onClick={() => void api.clearIdleMedia(group.id)}>
                {strings.clearFiles}
              </button>
            )}
          </div>
        </div>
      )}

      {!stage && group.idle === 'loop' && (
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

      {!stage && (needsMedia || needsLogo) && (
        <p className="warn idle-warn">{needsLogo ? strings.idleNeedsLogo : strings.idleNeedsFiles}</p>
      )}
    </div>
  )
}
