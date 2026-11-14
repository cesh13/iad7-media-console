import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ContentLayer, EndAction, ImageFit, ItemSettings, ServiceItem, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { ScreenView, type PlaybackReport } from '../view/ScreenView'
import { useAudioDevices } from './AudioTab'
import { BiblePreview, SongPreview } from './BiblePreview'
import { MediaButton } from './MediaIcons'

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
  if (item.type === 'bible') return <BiblePreview key={item.id} state={state} item={item} />
  // A folder shows its chosen file.
  if (item.type === 'folder') {
    if (!item.child)
      return (
        <section className="panel preview">
          <div className="preview-head">
            <h2 className="label">{strings.previewLabel}</h2>
            <div className="preview-title">
              <span className="selected-title">{item.title}</span>
              <span className="dim mono">{strings.fileCount(item.folder?.count ?? 0)}</span>
            </div>
            <TargetSelect state={state} />
          </div>
          <div className="preview-box preview-empty">
            <span className="dim">{strings.folderChooseHint}</span>
          </div>
        </section>
      )
    return <PreviewPanel state={state} item={item.child} />
  }
  if (item.type === 'song') return <SongPreview key={item.id} state={state} item={item} />
  if (item.type === 'countdown') return <CountdownPreview key={item.id} state={state} item={item} />
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
  const [page, setPage] = useState(0)
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
        seekId: seek?.id,
        page,
        pageUrls: item.pageUrls
      }
    : null

  const liveContent = state.groups.map((g) => g.live.content).find((c) => c?.itemId === item.id)
  const liveTake = liveContent?.take

  return (
    <section className="panel preview">
      <div className="preview-head">
        <h2 className="label">{strings.previewLabel}</h2>
        <div className="preview-title" title={item.path}>
          <span className="selected-title">{item.title}</span>
          <span className="dim mono">{metaLine(item)}</span>
        </div>
        <TargetSelect state={state} />
        <button className="btn btn-live" disabled={!ready} onClick={() => void api.goLive(item.id, undefined, page)}>
          {strings.goLive} ⏎
        </button>
      </div>

      <PreviewStage item={item}>
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
          {item.type === 'audio' && ready && <span className="preview-wait audio-preview">♪ {strings.audioItemNote}</span>}
          {item.type === 'video' && ready && <span className="preview-muted">{strings.previewMuted}</span>}
        </div>
      </PreviewStage>

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
      {item.type === 'slides' && ready && (
        <SlidesOptions item={item} page={page} livePage={liveContent?.page} onPage={setPage} set={set} />
      )}

      <NotesAndStatus item={item} />
    </section>
  )
}

/**
 * The preview picture with the item notes in a column on its right. The notes
 * use the empty space next to the 16:9 picture. The same for every item type.
 */
export function PreviewStage({ item, children }: { item: ServiceItem; children: ReactNode }) {
  return (
    <div className="preview-stage">
      {children}
      <label className="preview-notes">
        <span className="label-inline">{strings.notes}</span>
        <NotesInput item={item} />
      </label>
    </div>
  )
}

/** "Auto-mark done", mark done, remove: one row, the same for every item type. */
export function NotesAndStatus({ item }: { item: ServiceItem }) {
  return (
    <div className="preview-common">
      <label className="check">
        <input
          type="checkbox"
          checked={item.settings.autoDone}
          onChange={(e) => void api.updateItem(item.id, { settings: { autoDone: e.target.checked } })}
        />
        {strings.autoDone}
      </label>
      {item.status === 'done' ? (
        <button className="btn btn-small" onClick={() => void api.setItemStatus(item.id, 'pending')}>
          {strings.markPending}
        </button>
      ) : (
        <button className="btn btn-small" onClick={() => void api.setItemStatus(item.id, 'done')}>
          {strings.markDone}
        </button>
      )}
      {item.cache === 'error' && (
        <button className="btn btn-small" onClick={() => void api.retryCopy(item.id)}>
          {strings.retryCopy}
        </button>
      )}
      <button className="btn btn-small btn-quiet" onClick={() => void api.removeItem(item.id)}>
        {strings.remove}
      </button>
    </div>
  )
}

function metaLine(item: ServiceItem): string {
  const parts: string[] = []
  if (item.width && item.height) parts.push(`${item.width}×${item.height}`)
  if (item.type === 'video') parts.push(formatTime(item.duration))
  if (item.type === 'slides' && item.pageUrls) parts.push(strings.slideCount(item.pageUrls.length))
  parts.push(item.cache === 'ready' ? strings.localCopyOk : strings.cacheStates(item))
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
        <MediaButton icon={playing ? 'pause' : 'play'} label={playing ? strings.pause : strings.play} onClick={onPlay} />
        <MediaButton icon="back10" label={strings.back10} quiet onClick={() => onJump(now - 10)} />
        <MediaButton icon="forward10" label={strings.forward10} quiet onClick={() => onJump(now + 10)} />
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
        <span className="tool-sep" />
        <button className="btn btn-small" title={strings.points} onClick={() => set({ start: now })}>
          {strings.setStart} {s.start ? formatTime(s.start) : ''}
        </button>
        <button className="btn btn-small" title={strings.points} onClick={() => set({ end: now > (s.start ?? 0) ? now : undefined })}>
          {strings.setEnd} {s.end ? formatTime(s.end) : ''}
        </button>
        {(s.start || s.end) && (
          <button className="btn btn-small btn-quiet" title={strings.clearPoints} onClick={() => set({ start: undefined, end: undefined })}>
            ✕
          </button>
        )}
      </div>

      <div className="option-cols">
        <div className="option">
          <span className="label-inline">{strings.whenEnds}</span>
          <select
            className="input select"
            value={s.endAction ?? 'idle'}
            onChange={(e) => set({ endAction: e.target.value as EndAction })}
          >
            {endActions.map((a) => (
              <option key={a} value={a}>
                {strings.endActions[a]}
              </option>
            ))}
          </select>
        </div>

        <div className="option">
          <span className="label-inline">{strings.soundLabel}</span>
          <div className="volume-row">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume ?? 1}
              title={strings.volume}
              onChange={(e) => set({ volume: Number(e.target.value) })}
            />
            <span className="mono">{Math.round((s.volume ?? 1) * 100)}%</span>
          </div>
          <VideoAudioOptions item={item} set={set} />
        </div>

        <div className="option">
          <span className="label-inline">{strings.cues}</span>
          <form
            className="cue-form"
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
            <button className="btn btn-small" type="submit" title={strings.addCue}>
              + {formatTime(now)}
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
      </div>
    </div>
  )
}

/** Sound of a video: stop the background music, and the output device (SPEC 6). */
function VideoAudioOptions({ item, set }: { item: ServiceItem; set: (s: Partial<ItemSettings>) => void }) {
  const devices = useAudioDevices()
  const s = item.settings
  return (
    <>
      <select className="input select" title={strings.audioLabel} value={s.audioDevice ?? ''} onChange={(e) => set({ audioDevice: e.target.value })}>
        <option value="">{strings.mainDevice}</option>
        {devices
          .filter((d) => d.deviceId !== 'default')
          .map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 12)}
            </option>
          ))}
      </select>
      <label className="check">
        <input type="checkbox" checked={!!s.fade} onChange={(e) => set({ fade: e.target.checked })} />
        {strings.fade}
      </label>
      <label className="check">
        <input type="checkbox" checked={!!s.stopMusic} onChange={(e) => set({ stopMusic: e.target.checked })} />
        {strings.stopMusic}
      </label>
    </>
  )
}

// ---- Countdown ----

function CountdownPreview({ state, item }: { state: ServiceState; item: ServiceItem }) {
  const s = item.settings
  const set = (settings: Partial<ItemSettings>) => void api.updateItem(item.id, { settings })
  const [title, setTitle] = useState(item.title)
  const [minutes, setMinutes] = useState(String(Math.floor((s.countdownSeconds ?? 300) / 60)))
  const [secs, setSecs] = useState(String((s.countdownSeconds ?? 300) % 60))
  // The preview counts from the full time and does not move.
  const content: ContentLayer = {
    itemId: item.id,
    type: 'countdown',
    url: '',
    settings: s,
    take: -1,
    playing: false,
    endsAt: Date.now() + (s.countdownMode === 'until' ? 0 : (s.countdownSeconds ?? 300) * 1000)
  }
  const saveDuration = (m: string, sec: string) => set({ countdownSeconds: Math.max(0, Number(m) * 60 + Number(sec)) })

  return (
    <section className="panel preview">
      <div className="preview-head">
        <h2 className="label">{strings.previewLabel}</h2>
        <div className="preview-title">
          <input
            className="input title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== item.title && void api.updateItem(item.id, { title })}
          />
        </div>
        <TargetSelect state={state} />
        <button className="btn btn-live" onClick={() => void api.goLive(item.id)}>
          {strings.goLive} ⏎
        </button>
      </div>
      <PreviewStage item={item}>
        <div className="preview-box">
          <ScreenView content={content} idle={blackIdle} overlays={noOverlays} />
        </div>
      </PreviewStage>
      <div className="option-grid">
        <div className="option">
          <span className="label-inline">{strings.countdownMode}</span>
          <div className="chips">
            <button className={s.countdownMode !== 'until' ? 'chip is-on' : 'chip'} onClick={() => set({ countdownMode: 'duration' })}>
              {strings.countdownDuration}
            </button>
            <button className={s.countdownMode === 'until' ? 'chip is-on' : 'chip'} onClick={() => set({ countdownMode: 'until' })}>
              {strings.countdownUntil}
            </button>
          </div>
          {s.countdownMode === 'until' ? (
            <input className="input input-num" type="time" value={s.untilTime ?? ''} onChange={(e) => set({ untilTime: e.target.value })} />
          ) : (
            <div className="button-row tight">
              <input
                className="input input-num"
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                onBlur={() => saveDuration(minutes, secs)}
              />
              <span className="dim small">{strings.minutes}</span>
              <input
                className="input input-num"
                type="number"
                min={0}
                max={59}
                value={secs}
                onChange={(e) => setSecs(e.target.value)}
                onBlur={() => saveDuration(minutes, secs)}
              />
              <span className="dim small">s</span>
            </div>
          )}
        </div>
        <div className="option">
          <span className="label-inline">{strings.textAbove}</span>
          <TextSetting value={s.textAbove ?? ''} placeholder={strings.textAbovePlaceholder} onSave={(v) => set({ textAbove: v })} />
        </div>
        <div className="option">
          <span className="label-inline">{strings.atZero}</span>
          <div className="chips">
            {(['next', 'logo', 'stay'] as const).map((a) => (
              <button key={a} className={(s.atZero ?? 'next') === a ? 'chip is-on' : 'chip'} onClick={() => set({ atZero: a })}>
                {strings.atZeroActions[a]}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={!!s.showOnStage} onChange={(e) => set({ showOnStage: e.target.checked })} />
            {strings.showOnStage}
          </label>
        </div>
      </div>
      <NotesAndStatus item={item} />
    </section>
  )
}

/** A text option that is saved when the field loses focus. */
function TextSetting({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      className="input"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onSave(text)}
    />
  )
}

// ---- Slides ----

function SlidesOptions(props: {
  item: ServiceItem
  page: number
  livePage?: number
  onPage: (page: number) => void
  set: (s: Partial<ItemSettings>) => void
}) {
  const { item, page, livePage, onPage, set } = props
  const urls = item.pageUrls ?? []
  const s = item.settings
  return (
    <div className="slides-options">
      <div className="video-controls">
        <button className="btn" disabled={page === 0} onClick={() => onPage(page - 1)}>
          ← {strings.prevPage}
        </button>
        <span className="mono">{strings.pageOf(page + 1, urls.length)}</span>
        <button className="btn" disabled={page >= urls.length - 1} onClick={() => onPage(page + 1)}>
          {strings.nextPage} →
        </button>
        <span className="dim small">{strings.slidesHelp}</span>
      </div>
      <div className="thumbs">
        {urls.map((url, i) => (
          <button
            key={url}
            className={['thumb-page', i === page ? 'is-preview' : '', i === livePage ? 'is-live' : ''].join(' ')}
            onClick={() => onPage(i)}
            onDoubleClick={() => void api.showPage(item.id, i)}
            title={item.pageTexts?.[i]}
          >
            <img src={url} alt="" loading="lazy" />
            <span className="thumb-num mono">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="option-grid">
        <div className="option">
          <span className="label-inline">{strings.autoNextLabel}</span>
          <div className="button-row tight">
            <label className="check">
              <input
                type="checkbox"
                checked={!!s.autoAdvance}
                onChange={(e) => set({ autoAdvance: e.target.checked ? 8 : null })}
              />
              {strings.autoAdvanceEvery}
            </label>
            <input
              className="input input-num"
              type="number"
              min={1}
              disabled={!s.autoAdvance}
              value={s.autoAdvance ?? 8}
              onChange={(e) => set({ autoAdvance: Math.max(1, Number(e.target.value)) })}
            />
            <span className="dim">s</span>
            <label className="check">
              <input type="checkbox" checked={!!s.loop} onChange={(e) => set({ loop: e.target.checked })} />
              {strings.loopSlides}
            </label>
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
