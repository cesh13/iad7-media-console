import { useEffect, useState } from 'react'
import type { OutputStatus, ScreenInfo, ScreensState } from '../../../shared/types'
import { strings } from '../strings'
import { GroupsEditor } from './GroupsEditor'
import { useScreensState } from './hooks'

const api = window.mediaConsole

/** Screen setup: name the output screens, test them, and edit groups. */
export function ScreensPage() {
  const [state, setState] = useScreensState()

  if (!state) return null

  const missing = state.outputs.filter((o) => !o.screen)

  return (
    <main className="content">
      <div className="toolbar">
        <p className="help">{strings.screensHelp}</p>
        <button
          className="btn btn-primary"
          onClick={() => void api.openTest(state.screens.map((s) => s.electronId)).then(setState)}
        >
          {strings.testAll}
        </button>
        <button
          className="btn"
          disabled={state.testOpen.length === 0}
          onClick={() => void api.closeTests().then(setState)}
        >
          {strings.closeTests}
        </button>
      </div>

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
        <h2 className="label">{strings.layoutLabel}</h2>
        <ScreenLayout screens={state.screens} outputs={state.outputs} />
      </section>

      <section className="panel">
        <h2 className="label">{strings.detectedLabel}</h2>
        {state.screens.length === 0 && <p className="help">{strings.noScreens}</p>}
        <div className="screen-list">
          {state.screens.map((s, i) => (
            <ScreenCard
              key={s.electronId}
              index={i + 1}
              screen={s}
              output={state.outputs.find((o) => o.screen?.electronId === s.electronId) ?? null}
              testOpen={state.testOpen.includes(s.electronId)}
              onState={setState}
            />
          ))}
        </div>
      </section>

      <GroupsEditor state={state} />
    </main>
  )
}

/** A small drawing of the screens in their Windows positions. */
function ScreenLayout({ screens, outputs }: { screens: ScreenInfo[]; outputs: OutputStatus[] }) {
  if (screens.length === 0) return null
  const minX = Math.min(...screens.map((s) => s.x))
  const minY = Math.min(...screens.map((s) => s.y))
  const maxX = Math.max(...screens.map((s) => s.x + s.width))
  const maxY = Math.max(...screens.map((s) => s.y + s.height))
  return (
    <svg className="layout" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}>
      {screens.map((s, i) => {
        const name = outputs.find((o) => o.screen?.electronId === s.electronId)?.output.name
        const pad = Math.min(s.width, s.height) * 0.02
        return (
          <g key={s.electronId}>
            <rect
              x={s.x + pad}
              y={s.y + pad}
              width={s.width - pad * 2}
              height={s.height - pad * 2}
              rx={pad * 2}
              className={name ? 'layout-screen is-output' : 'layout-screen'}
            />
            <text x={s.x + s.width / 2} y={s.y + s.height / 2} className="layout-text">
              {i + 1}
              {name ? ` · ${name}` : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ScreenCard(props: {
  index: number
  screen: ScreenInfo
  output: OutputStatus | null
  testOpen: boolean
  onState: (s: ScreensState) => void
}) {
  const { index, screen: s, output, testOpen, onState } = props
  const savedName = output?.output.name ?? ''
  const [name, setName] = useState(savedName)
  useEffect(() => setName(savedName), [savedName])

  const changed = name.trim() !== savedName && name.trim() !== ''

  return (
    <div className={output ? 'screen-card is-output' : 'screen-card'}>
      <div className="screen-num mono">{index}</div>
      <div className="screen-info">
        <div className="screen-title">
          {s.label}
          {s.isPrimary && <span className="badge">{strings.primary}</span>}
          {testOpen && <span className="badge badge-preview">{strings.testOpen}</span>}
        </div>
        <div className="mono dim">
          {s.width}×{s.height} · {strings.position(s.x, s.y)} · {strings.scale(s.scaleFactor)}
        </div>
        {output && output.output.displayKey !== s.displayKey && (
          <div className="mono warn">{strings.savedKey(output.output.displayKey)}</div>
        )}
      </div>
      <form
        className="screen-form"
        onSubmit={(e) => {
          e.preventDefault()
          void api.saveOutput(s.displayKey, name).then(onState)
        }}
      >
        <input
          className="input"
          value={name}
          placeholder={strings.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!changed && (!output || output.output.displayKey === s.displayKey)}>
          {strings.save}
        </button>
        {output ? (
          <button
            className="btn"
            type="button"
            onClick={() => void api.removeOutput(output.output.id).then(onState)}
          >
            {strings.remove}
          </button>
        ) : (
          <span className="dim not-output">{strings.notOutput}</span>
        )}
      </form>
      <button className="btn" onClick={() => void api.openTest([s.electronId]).then(onState)}>
        {strings.test}
      </button>
    </div>
  )
}
