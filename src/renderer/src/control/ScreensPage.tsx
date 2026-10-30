import { useEffect, useState } from 'react'
import type { GroupConfig, GroupView, OutputStatus, ScreenInfo, ScreensState, ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { GroupsEditor, LogoSection } from './GroupsEditor'
import { useScreensState, useServiceState } from './hooks'
import { RemoteSection } from './RemoteSection'
import { GroupLiveView } from './ScreensColumn'

const api = window.mediaConsole

/** Screen setup: name the output screens, choose their group, test them, edit groups, and choose the logo. */
export function ScreensPage() {
  const [state, setState] = useScreensState()
  const service = useServiceState()

  if (!state) return null

  const missing = state.outputs.filter((o) => !o.screen)

  return (
    <main className="content">
      {missing.length > 0 && (
        <section className="panel panel-warn">
          <h2 className="label">{strings.missingLabel}</h2>
          <p className="help">{strings.missingHelp}</p>
          {missing.map((o) => (
            <div key={o.output.id} className="missing-row">
              <span className="missing-name">{o.output.name}</span>
              <span className="mono dim">{o.output.displayKey}</span>
              <button className="btn" onClick={() => void api.removeOutput(o.output.id).then(setState)}>
                {strings.remove}
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2 className="label">{strings.screensLabel}</h2>
          {state.testOpen.length > 0 && (
            <button className="btn" onClick={() => void api.closeTests().then(setState)}>
              {strings.closeTests}
            </button>
          )}
          <button
            className="btn"
            onClick={() => void api.openTest(state.screens.map((s) => s.electronId)).then(setState)}
          >
            {strings.testAll}
          </button>
        </div>
        <p className="help">{strings.screensHelp}</p>
        {state.screens.length === 0 && <p className="help">{strings.noScreens}</p>}
        <div className="screen-list">
          {state.screens.map((s, i) => (
            <ScreenCard
              key={s.electronId}
              index={i + 1}
              screen={s}
              output={state.outputs.find((o) => o.screen?.electronId === s.electronId) ?? null}
              groups={state.groups}
              service={service}
              testOpen={state.testOpen.includes(s.electronId)}
              isConsole={state.consoleScreen === s.electronId}
              onState={setState}
            />
          ))}
        </div>
      </section>

      <GroupsEditor state={state} />
      <LogoSection state={state} />
      <RemoteSection />
    </main>
  )
}

function ScreenCard(props: {
  index: number
  screen: ScreenInfo
  output: OutputStatus | null
  groups: GroupConfig[]
  service: ServiceState | null
  testOpen: boolean
  isConsole: boolean
  onState: (s: ScreensState) => void
}) {
  const { index, screen: s, output, groups, service, testOpen, isConsole, onState } = props
  const savedName = output?.output.name ?? ''
  const [name, setName] = useState(savedName)
  useEffect(() => setName(savedName), [savedName])

  // The name saves on Enter or when the input loses focus. An empty name keeps the old name.
  const saveName = () => {
    const trimmed = name.trim()
    if (!trimmed) setName(savedName)
    else if (trimmed !== savedName) void api.saveOutput(s.displayKey, trimmed).then(onState)
  }
  const keyChanged = !!output && output.output.displayKey !== s.displayKey
  const groupId = output ? (groups.find((g) => g.outputIds.includes(output.output.id))?.id ?? '') : ''
  // An output screen shows a live copy of its group. Without a group the real screen is black.
  const groupView: GroupView | undefined = groupId ? service?.groups.find((g) => g.config.id === groupId) : undefined
  const live = !!output && !!service
  // The control screen cannot be used for output. Show the switch there only if it is an output already.
  const showForm = !isConsole || !!output

  return (
    <div className={output ? 'screen-card is-output' : 'screen-card'}>
      {/* The "screen": same shape as the real screen, with its number and output name. */}
      <div
        className={live ? 'screen-face is-live' : 'screen-face'}
        style={{ aspectRatio: `${s.width} / ${s.height}` }}
        title={`${s.label} · ${s.width}×${s.height} · ${strings.position(s.x, s.y)} · ${strings.scale(s.scaleFactor)}${s.isPrimary ? ` · ${strings.primary}` : ''}`}
      >
        {live ? (
          <>
            {groupView ? <GroupLiveView group={groupView} state={service} /> : <div className="screen-view" />}
            <div className="screen-face-label">
              <span className="screen-tag-num mono">{index}</span>
              {output.output.name}
              {!groupView && <span className="warn"> · {strings.noGroup}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="screen-face-num">{index}</div>
            <div className="screen-face-name">{output ? output.output.name : isConsole ? strings.controlScreen : strings.notUsed}</div>
            <div className="mono dim screen-face-info">
              {s.label} · {s.width}×{s.height}
            </div>
          </>
        )}
        <div className="screen-badges">
          {isConsole && <span className="badge">{strings.consoleScreen}</span>}
          {testOpen && <span className="badge badge-preview">{strings.testOpen}</span>}
        </div>
      </div>

      <div className="screen-controls">
        {showForm ? (
          <>
            <label className="switch" title={strings.useScreenHelp}>
              <input
                type="checkbox"
                role="switch"
                checked={!!output}
                onChange={(e) =>
                  void (e.target.checked
                    ? api.saveOutput(s.displayKey, strings.defaultScreenName(index))
                    : api.removeOutput(output!.output.id)
                  ).then(onState)
                }
              />
              <span className="switch-track" />
              {strings.useScreen}
            </label>
            {output && (
              <input
                className="input"
                value={name}
                title={strings.nameHelp}
                aria-label={strings.screenName}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            )}
            {output && (
              <select
                className={groupId ? 'input select' : 'input select is-warn'}
                value={groupId}
                title={strings.groupSelectHelp}
                onChange={(e) => void api.assignOutput(output.output.id, e.target.value || null)}
              >
                <option value="">{strings.noGroup}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {strings.groupOption(g.name)}
                  </option>
                ))}
              </select>
            )}
          </>
        ) : (
          <p className="dim small screen-note">{strings.controlScreenHelp}</p>
        )}
        {keyChanged && (
          <div className="mono warn small">
            {strings.savedKey(output.output.displayKey)}{' '}
            <button className="btn btn-small" onClick={() => void api.saveOutput(s.displayKey, savedName).then(onState)}>
              {strings.updateKey}
            </button>
          </div>
        )}
        {isConsole && output && <div className="warn small">{strings.consoleOutputWarn}</div>}
        {testOpen ? (
          <button className="btn btn-on" onClick={() => void api.closeTests([s.electronId]).then(onState)}>
            {strings.closeTest}
          </button>
        ) : (
          <button className="btn" onClick={() => void api.openTest([s.electronId]).then(onState)}>
            {strings.test}
          </button>
        )}
      </div>
    </div>
  )
}
