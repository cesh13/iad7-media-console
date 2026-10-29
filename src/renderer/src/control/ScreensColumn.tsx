import type { GroupView, ScreensState, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { ScreenView } from '../view/ScreenView'
import { StageView } from '../view/StageView'
import { useAudioState } from './AudioTab'
import { TypeIcon } from './OrderPanel'

const api = window.mediaConsole

/** Right column: one card per group, with what it shows now (SPEC 5.4). */
export function ScreensColumn({
  state,
  screens,
  onOpenScreens
}: {
  state: ServiceState
  screens: ScreensState | null
  onOpenScreens: () => void
}) {
  const outputs = screens?.outputs ?? []
  const grouped = new Set(state.groups.flatMap((g) => g.config.outputIds))
  const ungrouped = outputs.filter((o) => !grouped.has(o.output.id))

  return (
    <aside className="group-col panel-col">
      <h2 className="label">{strings.screensColumn}</h2>
      {screens && !hasConnectedOutput(screens) && (
        <div className="no-outputs">
          <div className="no-outputs-title">{strings.noOutputsTitle}</div>
          <p className="help">{outputs.length === 0 ? strings.noOutputs : strings.noneConnected}</p>
          <button className="btn" onClick={onOpenScreens}>
            {strings.openScreensTab}
          </button>
        </div>
      )}
      <AudioLayerCard />
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

/** True when at least one output screen is connected now, so the service shows somewhere. */
export function hasConnectedOutput(screens: ScreensState): boolean {
  return screens.outputs.some((o) => o.screen)
}

/** The sound that plays now (one for all screens), with "Audio ✕" (SPEC 5.4 layer buttons). */
function AudioLayerCard() {
  const audio = useAudioState()
  if (!audio || (!audio.item && !audio.playing)) return null
  const track = audio.settings.playlist[audio.index]
  return (
    <div className="group-card audio-card">
      <div className="group-card-head">
        <span className="group-card-name">{strings.audioLabel}</span>
        <button className="btn btn-small btn-quiet" disabled={!audio.item} onClick={() => void api.stopItemAudio()}>
          {strings.audioX}
        </button>
      </div>
      {audio.item && (
        <div className="group-now">
          <span className="tag tag-live">{strings.badgeLive}</span>
          <span className="row-title">{audio.item.title}</span>
        </div>
      )}
      {audio.playing && track && (
        <div className="group-now dim">
          ♪ <span className="row-title">{track.path.split(/[\\/]/).pop()}</span>
          {audio.ducked && <span className="badge">{strings.duckedBadge}</span>}
        </div>
      )}
    </div>
  )
}

/** A small live copy of what the screens of a group show now (no sound). Fills its parent. */
export function GroupLiveView({ group, state }: { group: GroupView; state: ServiceState }) {
  const { config, live } = group
  if (group.stage) return <StageView stage={group.stage} />
  const playback = live.content ? state.playback[live.content.take] : undefined
  return (
    <ScreenView
      content={live.content}
      text={live.text}
      idle={{
        kind: config.idle,
        media: config.idleMedia
          .filter((m) => m.url && m.type !== 'audio')
          .map((m) => ({ type: m.type as 'image' | 'video', url: m.url! })),
        interval: config.idleInterval
      }}
      logoUrl={state.logoUrl}
      overlays={state.overlays}
      syncTime={playback?.currentTime}
    />
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
    <div className={content || live.text ? 'group-card is-live' : 'group-card'}>
      <div className="group-card-head">
        <span className="group-card-name">{config.name}</span>
        {isTarget && <span className="badge badge-preview">{strings.target}</span>}
        <button className="btn btn-small btn-quiet" disabled={!live.text} onClick={() => void api.clearText(config.id)}>
          {strings.textX}
        </button>
        <button className="btn btn-small btn-quiet" disabled={!content} onClick={() => void api.clear(config.id)}>
          {strings.clear}
        </button>
      </div>
      <div className="mini">
        <GroupLiveView group={group} state={state} />
      </div>
      {content && item ? (
        <div className="group-now">
          <span className="tag tag-live">{strings.badgeLive}</span>
          <TypeIcon type={item.type} />
          <span className="row-title">{item.title}</span>
          {item.type === 'video' && <span className="mono dim">{formatTime(playback?.currentTime)}</span>}
        </div>
      ) : live.text ? (
        <div className="group-now">
          <span className="tag tag-live">{strings.badgeLive}</span>
          <span className="row-title">{live.text.title}</span>
          <span className="mono dim">{live.text.screens[live.text.index]?.label}</span>
        </div>
      ) : (
        <div className="group-now dim">
          {strings.idleShort}: {strings.idleKinds[config.idle]}
        </div>
      )}
      {outputs.length === 0 && (screens?.outputs.length ?? 0) > 0 && (
        <div className="dim group-empty">{strings.groupNoScreens}</div>
      )}
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
