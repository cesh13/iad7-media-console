import type { GroupView, ScreensState, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { TypeIcon } from './OrderPanel'

const api = window.mediaConsole

/** Right column: one card per group, with what it shows now (SPEC 5.4). */
export function ScreensColumn({ state, screens }: { state: ServiceState; screens: ScreensState | null }) {
  const outputs = screens?.outputs ?? []
  const grouped = new Set(state.groups.flatMap((g) => g.config.outputIds))
  const ungrouped = outputs.filter((o) => !grouped.has(o.output.id))

  return (
    <aside className="group-col panel-col">
      <h2 className="label">{strings.screensColumn}</h2>
      {outputs.length === 0 && <p className="help">{strings.noOutputs}</p>}
      {state.groups.map((g) => (
        <GroupCard key={g.config.id} group={g} state={state} screens={screens} />
      ))}
      {ungrouped.length > 0 && (
        <div className="group-card panel-warn">
          <div className="warn">{strings.newScreens}</div>
          {ungrouped.map((o) => (
            <div key={o.output.id} className="group-output">
              <span className="dot dot-warn" />
              <span className="group-output-name">{o.output.name}</span>
              <select
                className="input select select-small"
                value=""
                onChange={(e) => void api.assignOutput(o.output.id, e.target.value || null)}
              >
                <option value="">{strings.addToGroup}</option>
                {state.groups.map((g) => (
                  <option key={g.config.id} value={g.config.id}>
                    {g.config.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

function GroupCard({ group, state, screens }: { group: GroupView; state: ServiceState; screens: ScreensState | null }) {
  const { config, live } = group
  const content = live.content
  const item = content ? state.service.items.find((i) => i.id === content.itemId) : undefined
  const playback = content ? state.playback[content.take] : undefined
  const outputs = (screens?.outputs ?? []).filter((o) => config.outputIds.includes(o.output.id))
  const isTarget = state.target === 'all' || state.target === config.id

  return (
    <div className={content ? 'group-card is-live' : 'group-card'}>
      <div className="group-card-head">
        <span className="group-card-name">{config.name}</span>
        {isTarget && <span className="badge badge-preview">{strings.target}</span>}
        <button className="btn btn-small btn-quiet" disabled={!content} onClick={() => void api.clear(config.id)}>
          {strings.clear}
        </button>
      </div>
      {content && item ? (
        <div className="group-now">
          <span className="tag tag-live">{strings.badgeLive}</span>
          <TypeIcon type={item.type} />
          <span className="row-title">{item.title}</span>
          {item.type === 'video' && <span className="mono dim">{formatTime(playback?.currentTime)}</span>}
        </div>
      ) : (
        <div className="group-now dim">
          {strings.idleShort}: {strings.idleKinds[config.idle]}
        </div>
      )}
      {outputs.length === 0 && <div className="dim group-empty">{strings.groupNoScreens}</div>}
      {outputs.map((o) => (
        <div key={o.output.id} className="group-output">
          <span className={o.screen ? 'dot dot-ok' : 'dot dot-warn'} />
          <span className="group-output-name">{o.output.name}</span>
          <span className="dim">{o.screen ? strings.connected : strings.notConnected}</span>
        </div>
      ))}
    </div>
  )
}
