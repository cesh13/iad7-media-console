import { useEffect, useRef, useState } from 'react'
import type { ContentLayer, EndAction, ImageFit, ItemSettings, ServiceItem, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { ScreenView, type PlaybackReport } from '../view/ScreenView'

const api = window.mediaConsole

const endActions: EndAction[] = ['next', 'idle', 'black', 'hold', 'loop']
const fits: ImageFit[] = ['fit', 'fill', 'blur']
const noOverlays = { black: false, logo: false }
const blackIdle = { kind: 'black' as const, media: [], interval: 8 }

/**
 * Preview of the selected item (SPEC 5.3). Nothing goes on the screens until
 * "Go live". The picture uses the same view as the output windows.
 */
export function PreviewPanel({ state, item }: { state: ServiceState; item: ServiceItem | null }) {
  if (!item)
    return (
      <section className="panel preview">
        <div className="preview-head">
          <h2 className="label">{strings.previewLabel}</h2>
          <TargetSelect state={state} />
        </div>
        <div className="preview-box preview-empty">
          <span className="dim">{strings.noSelection}</span>
        </div>
      </section>
    )
  return <ItemPreview key={item.id} state={state} item={item} />
}

export function TargetSelect({ state }: { state: ServiceState }) {
  return (
    <label className="target">
      <span className="label-inline">{strings.sendTo}</span>
      <select className="input select" value={state.target} onChange={(e) => void api.setTarget(e.target.value)}>
        <option value="all">{strings.allScreens}</option>
        {state.groups.map((g) => (
          <option key={g.config.id} value={g.config.id}>
            {g.config.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ItemPreview({ state, item }: { state: ServiceState; item: ServiceItem }) {
  const ready = item.cache === 'ready' && !!item.url
  const [playing, setPlaying] = useState(false)
  const [seek, setSeek] = useState<{ to: number; id: number } | null>(null)
  const [time, setTime] = useState<PlaybackReport | null>(null)
  const seekCounter = useRef(0)

  const set = (settings: Partial<ItemSettings>) => void api.updateItem(item.id, { settings })
  const jump = (to: number) => setSeek({ to: Math.max(0, to), id: ++seekCounter.current })

  // The preview never has sound and uses its own take number, so it never affects the live output.
  const content: ContentLayer | null = ready
    ? {
        itemId: item.id,
        type: item.type,
        url: item.url!,
        settings: item.settings,
        take: -1,
        playing,
        seekTo: seek?.to,
        seekId: seek?.id
      }
    : null

  const liveTake = state.groups.map((g) => g.live.content).find((c) => c?.itemId === item.id)?.take

  return (
    <section className="panel preview">
      <div className="preview-head">
        <h2 className="label">{strings.previewLabel}</h2>
        <div className="preview-title">
          <span className="selected-title">{item.title}</span>
          <span className="dim mono">{metaLine(item)}</span>
        </div>
        <TargetSelect state={state} />
        <button className="btn btn-live" disabled={!ready} onClick={() => void api.goLive(item.id)}>
          {strings.goLive} ⏎
        </button>
      </div>

      <div className="preview-box">
        {content && (
          <ScreenView
            content={content}
            idle={blackIdle}
            overlays={noOverlays}
            onPlayback={(r) => {
              setTime(r)
              if (r.ended) setPlaying(false)
            }}
          />
        )}
        {!ready && <span className="dim preview-wait">{item.cache === 'error' ? item.cacheError : strings.notReady}</span>}
        {item.type === 'video' && ready && <span className="preview-muted">{strings.previewMuted}</span>}
      </div>

      {item.type === 'video' && ready && (
        <VideoOptions
          item={item}
          time={time}
          playing={playing}
          liveTake={liveTake}
          onPlay={() => setPlaying(!playing)}
          onJump={jump}
          set={set}
        />
      )}
      {item.type === 'image' && <ImageOptions item={item} set={set} />}

      <div className="preview-common">
        <label className="field-col">
          <span className="label-inline">{strings.notes}</span>
          <NotesInput item={item} />
        </label>
        <div className="field-col">
          <label className="check">
            <input type="checkbox" checked={item.settings.autoDone} onChange={(e) => set({ autoDone: e.target.checked })} />
            {strings.autoDone}
          </label>
          <div className="button-row">
            {item.status === 'done' ? (
              <button className="btn" onClick={() => void api.setItemStatus(item.id, 'pending')}>
                {strings.markPending}
              </button>
            ) : (
              <button className="btn" onClick={() => void api.setItemStatus(item.id, 'done')}>
                {strings.markDone}
              </button>
            )}
            {item.cache === 'error' && (
              <button className="btn" onClick={() => void api.retryCopy(item.id)}>
                {strings.retryCopy}
              </button>
            )}
            <button className="btn btn-quiet" onClick={() => void api.removeItem(item.id)}>
              {strings.remove}
            </button>
          </div>
          <span className="mono dim path">{item.path}</span>
        </div>
      </div>
    </section>
  )
}

function metaLine(item: ServiceItem): string {
  const parts: string[] = []
  if (item.width && item.height) parts.push(`${item.width}×${item.height}`)
  if (item.type === 'video') parts.push(formatTime(item.duration))
  parts.push(item.cache === 'ready' ? strings.localCopyOk : item.cache === 'copying' ? strings.copying(item.cacheProgress ?? 0) : strings.copyError)
  return parts.join(' · ')
}

/** Notes are saved when the field loses focus, not on every key. */
function NotesInput({ item }: { item: ServiceItem }) {
  const [text, setText] = useState(item.notes ?? '')
  useEffect(() => setText(item.notes ?? ''), [item.notes])
  return (
    <textarea
      className="input notes"
      value={text}
      placeholder={strings.notesPlaceholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== (item.notes ?? '') && void api.updateItem(item.id, { notes: text })}
    />
  )
}

// ---- Video ----

function VideoOptions(props: {
  item: ServiceItem
  time: PlaybackReport | null
  playing: boolean
  liveTake?: number
  onPlay: () => void
  onJump: (to: number) => void
  set: (s: Partial<ItemSettings>) => void
}) {
  const { item, time, playing, liveTake, onPlay, onJump, set } = props
  const s = item.settings
  const duration = time?.duration || item.duration || 0
  const now = time?.currentTime ?? s.start ?? 0
  const [cueLabel, setCueLabel] = useState('')
  const pct = (t: number) => `${duration ? (t / duration) * 100 : 0}%`
  const cues = s.cues ?? []

  return (
    <div className="video-options">
      <div className="video-controls">
        <button className="btn" onClick={onPlay}>
          {playing ? strings.pause : strings.play}
        </button>
        <button className="btn" onClick={() => onJump(now - 10)}>
          {strings.back10}
        </button>
        <button className="btn" onClick={() => onJump(now + 10)}>
          {strings.forward10}
        </button>
        <span className="mono">{formatTime(now)}</span>
        <div className="timebar-wrap">
          <input
            className="timebar timebar-preview"
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={now}
            onChange={(e) => onJump(Number(e.target.value))}
          />
          {s.start ? <span className="marker marker-start" style={{ left: pct(s.start) }} title={strings.startPoint} /> : null}
          {s.end ? <span className="marker marker-end" style={{ left: pct(s.end) }} title={strings.endPoint} /> : null}
          {cues.map((c) => (
            <span key={c.time} className="marker marker-cue" style={{ left: pct(c.time) }} title={c.label} />
          ))}
        </div>
        <span className="mono dim">{formatTime(duration || undefined)}</span>
      </div>

      <div className="option-grid">
        <div className="option">
          <span className="label-inline">{strings.points}</span>
          <div className="button-row tight">
            <button className="btn btn-small" onClick={() => set({ start: now })}>
              {strings.setStart} {s.start ? formatTime(s.start) : ''}
            </button>
            <button className="btn btn-small" onClick={() => set({ end: now > (s.start ?? 0) ? now : undefined })}>
              {strings.setEnd} {s.end ? formatTime(s.end) : ''}
            </button>
            {(s.start || s.end) && (
              <button className="btn btn-small btn-quiet" onClick={() => set({ start: undefined, end: undefined })}>
                {strings.clearPoints}
              </button>
            )}
          </div>
        </div>

        <div className="option">
          <span className="label-inline">{strings.cues}</span>
          <form
            className="button-row tight"
            onSubmit={(e) => {
              e.preventDefault()
              const label = cueLabel.trim() || formatTime(now)
              set({ cues: [...cues, { time: now, label }].sort((a, b) => a.time - b.time) })
              setCueLabel('')
            }}
          >
            <input
              className="input input-cue"
              value={cueLabel}
              placeholder={strings.cuePlaceholder}
              onChange={(e) => setCueLabel(e.target.value)}
            />
            <button className="btn btn-small" type="submit">
              + {strings.addCue} {formatTime(now)}
            </button>
          </form>
          {cues.map((c) => (
            <div key={c.time} className="cue-row">
              <span className="mono">{formatTime(c.time)}</span>
              <span className="cue-label">“{c.label}”</span>
              <button className="btn btn-small" onClick={() => onJump(c.time)}>
                {strings.jumpPreview}
              </button>
              {liveTake !== undefined && (
                <button className="btn btn-small btn-live-outline" onClick={() => void api.seek(liveTake, c.time)}>
                  {strings.jumpLive}
                </button>
              )}
              <button className="btn btn-small btn-quiet" onClick={() => set({ cues: cues.filter((x) => x !== c) })}>
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="option">
          <span className="label-inline">{strings.volume}</span>
          <div className="button-row tight">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume ?? 1}
              onChange={(e) => set({ volume: Number(e.target.value) })}
            />
            <span className="mono">{Math.round((s.volume ?? 1) * 100)}%</span>
            <label className="check">
              <input type="checkbox" checked={!!s.fade} onChange={(e) => set({ fade: e.target.checked })} />
              {strings.fade}
            </label>
          </div>
        </div>

        <div className="option">
          <span className="label-inline">{strings.whenEnds}</span>
          <div className="chips">
            {endActions.map((a) => (
              <button
                key={a}
                className={(s.endAction ?? 'idle') === a ? 'chip is-on' : 'chip'}
                onClick={() => set({ endAction: a })}
              >
                {strings.endActions[a]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Image ----

function ImageOptions({ item, set }: { item: ServiceItem; set: (s: Partial<ItemSettings>) => void }) {
  const s = item.settings
  const vertical = item.width && item.height && item.height > item.width
  return (
    <div className="option-grid">
      <div className="option">
        <span className="label-inline">{strings.fitLabel}</span>
        <div className="chips">
          {fits.map((f) => (
            <button key={f} className={(s.fit ?? 'fit') === f ? 'chip is-on' : 'chip'} onClick={() => set({ fit: f })}>
              {strings.fits[f]}
            </button>
          ))}
        </div>
        {vertical && (s.fit ?? 'fit') === 'fit' && <span className="dim small">{strings.verticalNote}</span>}
      </div>
      <div className="option">
        <span className="label-inline">{strings.autoNextLabel}</span>
        <div className="button-row tight">
          <label className="check">
            <input
              type="checkbox"
              checked={!!s.autoNext}
              onChange={(e) => set({ autoNext: e.target.checked ? 8 : null })}
            />
            {strings.autoNextAfter}
          </label>
          <input
            className="input input-num"
            type="number"
            min={1}
            disabled={!s.autoNext}
            value={s.autoNext ?? 8}
            onChange={(e) => set({ autoNext: Math.max(1, Number(e.target.value)) })}
          />
          <span className="dim">s</span>
        </div>
      </div>
    </div>
  )
}
