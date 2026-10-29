import { useEffect, useState, type DragEvent } from 'react'
import type { ScreensState, ServiceItem, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'

const api = window.mediaConsole
const itemDragType = 'application/x-media-console-item'

/** Service order, selected item and live controls (build step 2). */
export function ServicePage() {
  const [state, setState] = useState<ServiceState | null>(null)
  const [screens, setScreens] = useState<ScreensState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    void api.getService().then(setState)
    void api.getScreens().then(setScreens)
    const offService = api.onServiceChanged(setState)
    const offScreens = api.onScreensChanged(setScreens)
    return () => {
      offService()
      offScreens()
    }
  }, [])

  const items = state?.service.items ?? []
  const selected = items.find((i) => i.id === selectedId) ?? null

  // Keys: Space next item, Esc clear, ↑ ↓ select, Enter go live.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === ' ') {
        e.preventDefault()
        void api.next()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        void api.clear()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const index = items.findIndex((i) => i.id === selectedId)
        const nextIndex = e.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)
        if (items[nextIndex]) setSelectedId(items[nextIndex].id)
      } else if (e.key === 'Enter' && selectedId) {
        e.preventDefault()
        void api.goLive(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, selectedId])

  if (!state) return null

  return (
    <div className="service">
      <OrderPanel state={state} selectedId={selectedId} onSelect={setSelectedId} />
      <div className="service-center">
        <SelectedPanel item={selected} />
        <LivePanel state={state} />
      </div>
      <GroupCard state={state} screens={screens} />
    </div>
  )
}

// ---- Order ----

function OrderPanel(props: { state: ServiceState; selectedId: string | null; onSelect: (id: string) => void }) {
  const { state, selectedId, onSelect } = props
  const items = state.service.items
  const [dropActive, setDropActive] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const done = items.filter((i) => i.status === 'done').length

  const showResult = (r: { skipped: string[] }) => setSkipped(r.skipped)

  const isFileDrag = (e: DragEvent) => e.dataTransfer.types.includes('Files')

  const onDrop = (e: DragEvent) => {
    setDropActive(false)
    if (!isFileDrag(e)) return
    e.preventDefault()
    const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean)
    if (paths.length) void api.addFiles(paths).then(showResult)
  }

  return (
    <section
      className={dropActive ? 'order panel-col is-drop' : 'order panel-col'}
      onDragOver={(e) => {
        if (!isFileDrag(e)) return
        e.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false)
      }}
      onDrop={onDrop}
    >
      <div className="order-head">
        <h2 className="label">{strings.orderLabel}</h2>
        <button className="btn btn-small" onClick={() => void api.pickFiles().then(showResult)}>
          + {strings.addFiles}
        </button>
      </div>
      {items.length > 0 && (
        <div className="order-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <span className="dim">{strings.progress(done, items.length)}</span>
        </div>
      )}
      {skipped.length > 0 && <p className="order-note warn">{strings.skippedFiles(skipped)}</p>}

      <div className="order-list">
        {items.length === 0 && <p className="help order-empty">{strings.emptyOrder}</p>}
        {items.map((item, index) => (
          <OrderRow
            key={item.id}
            item={item}
            index={index}
            isNext={item.id === state.nextItemId}
            selected={item.id === selectedId}
            onSelect={() => onSelect(item.id)}
          />
        ))}
        {dropActive && <div className="drop-hint">{strings.dropHere}</div>}
      </div>

      {/* Read the length of videos that do not have one yet. */}
      {items
        .filter((i) => i.type === 'video' && i.url && i.duration === undefined)
        .map((i) => (
          <video
            key={i.id}
            className="hidden"
            preload="metadata"
            src={i.url}
            onLoadedMetadata={(e) => void api.setDuration(i.id, e.currentTarget.duration)}
          />
        ))}
    </section>
  )
}

function OrderRow(props: {
  item: ServiceItem
  index: number
  isNext: boolean
  selected: boolean
  onSelect: () => void
}) {
  const { item, index, isNext, selected, onSelect } = props
  const [dragOver, setDragOver] = useState(false)

  const classes = ['row', `is-${item.status}`]
  if (isNext && item.status !== 'live') classes.push('is-next')
  if (selected) classes.push('is-selected')
  if (dragOver) classes.push('is-drag-over')

  return (
    <div
      className={classes.join(' ')}
      draggable
      onClick={onSelect}
      onDoubleClick={() => void api.goLive(item.id)}
      onDragStart={(e) => e.dataTransfer.setData(itemDragType, item.id)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(itemDragType)) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false)
        const id = e.dataTransfer.getData(itemDragType)
        if (!id) return
        e.preventDefault()
        e.stopPropagation()
        void api.moveItem(id, index)
      }}
    >
      <StatusMark item={item} isNext={isNext} />
      <TypeIcon type={item.type} />
      <span className="row-title">{item.title}</span>
      <span className="row-meta mono">
        {item.cache === 'copying' && strings.copying(item.cacheProgress ?? 0)}
        {item.cache === 'error' && <span className="text-live">{strings.copyError}</span>}
        {item.cache === 'ready' && item.type === 'video' && formatTime(item.duration)}
      </span>
    </div>
  )
}

function StatusMark({ item, isNext }: { item: ServiceItem; isNext: boolean }) {
  if (item.status === 'live') return <span className="tag tag-live">{strings.badgeLive}</span>
  if (isNext) return <span className="tag tag-next">{strings.badgeNext}</span>
  if (item.status === 'done')
    return (
      <span className="status-done" aria-label="done">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
    )
  return <span className="status-pending" />
}

function TypeIcon({ type }: { type: ServiceItem['type'] }) {
  return (
    <span className="type-icon" title={type === 'video' ? strings.typeVideo : strings.typeImage}>
      {type === 'video' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M10 9l5 3-5 3z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M21 16l-5-5-9 8" />
        </svg>
      )}
    </span>
  )
}

// ---- Selected item ----

function SelectedPanel({ item }: { item: ServiceItem | null }) {
  if (!item)
    return (
      <section className="panel selected">
        <h2 className="label">{strings.selectedLabel}</h2>
        <p className="help">{strings.noSelection}</p>
      </section>
    )

  const ready = item.cache === 'ready'
  return (
    <section className="panel selected">
      <h2 className="label">{strings.selectedLabel}</h2>
      <div className="selected-body">
        <div className="thumb">
          {ready && item.type === 'image' && <img src={item.url} alt="" />}
          {ready && item.type === 'video' && <video src={`${item.url}#t=1`} preload="metadata" muted />}
        </div>
        <div className="selected-info">
          <div className="selected-title">{item.title}</div>
          <div className="dim">
            {item.type === 'video' ? strings.typeVideo : strings.typeImage}
            {item.type === 'video' && ` · ${formatTime(item.duration)}`}
          </div>
          <div className="kv">
            <span className="label-inline">{strings.source}</span>
            <span className="mono path">{item.path}</span>
          </div>
          {item.localCopyPath && (
            <div className="kv">
              <span className="label-inline">{strings.cachedCopy}</span>
              <span className="mono path">{item.localCopyPath}</span>
            </div>
          )}
          {item.cache === 'copying' && <p className="help">{strings.notReady}</p>}
          {item.cache === 'error' && <p className="text-live">{item.cacheError}</p>}
          <div className="button-row">
            <button className="btn btn-live" disabled={!ready} onClick={() => void api.goLive(item.id)}>
              {strings.goLive}
            </button>
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
        </div>
      </div>
    </section>
  )
}

// ---- Live ----

function LivePanel({ state }: { state: ServiceState }) {
  const { group, playback } = state
  const item = group.live ? state.service.items.find((i) => i.id === group.live!.itemId) : undefined
  const [dragTime, setDragTime] = useState<number | null>(null)

  const time = playback?.itemId === item?.id ? playback?.currentTime : undefined
  const duration = (playback?.itemId === item?.id && playback?.duration) || item?.duration || 0

  const commitSeek = () => {
    if (dragTime !== null) void api.seek(dragTime)
    setDragTime(null)
  }

  return (
    <section className={item ? 'panel live-panel is-live' : 'panel live-panel'}>
      <h2 className="label">{strings.liveLabel(group.name)}</h2>
      {item ? (
        <div className="live-now">
          <span className="tag tag-live">{strings.badgeLive}</span>
          <TypeIcon type={item.type} />
          <span className="live-title">{item.title}</span>
        </div>
      ) : (
        <p className="help">{strings.nothingLive}</p>
      )}

      {item?.type === 'video' && group.live && (
        <div className="video-controls">
          <button className="btn" onClick={() => void api.setPlaying(!group.live!.playing)}>
            {group.live.playing ? strings.pause : strings.play}
          </button>
          <button className="btn" onClick={() => void api.seek((time ?? 0) - 10)}>
            {strings.back10}
          </button>
          <button className="btn" onClick={() => void api.seek((time ?? 0) + 10)}>
            {strings.forward10}
          </button>
          <span className="mono">{formatTime(dragTime ?? time)}</span>
          <input
            className="timebar"
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={dragTime ?? time ?? 0}
            onChange={(e) => setDragTime(Number(e.target.value))}
            onPointerUp={commitSeek}
            onKeyUp={commitSeek}
          />
          <span className="mono dim">{formatTime(duration || undefined)}</span>
        </div>
      )}

      <div className="transport">
        <button className="btn btn-big" onClick={() => void api.previous()}>
          ← {strings.previous}
        </button>
        <button className="btn btn-big btn-next" onClick={() => void api.next()}>
          {strings.next} →
        </button>
        <button className="btn btn-big" disabled={!group.live} onClick={() => void api.clear()}>
          {strings.clear}
        </button>
        <span className="dim keys-help">{strings.keysHelp}</span>
      </div>
    </section>
  )
}

// ---- Group card ----

function GroupCard({ state, screens }: { state: ServiceState; screens: ScreensState | null }) {
  const outputs = screens?.outputs ?? []
  const firstConnected = outputs.find((o) => o.screen)
  return (
    <aside className="group-col panel-col">
      <h2 className="label">{strings.groupLabel(state.group.name)}</h2>
      {outputs.length === 0 && <p className="help">{strings.noOutputs}</p>}
      {outputs.map((o) => (
        <div key={o.output.id} className="group-output">
          <span className={o.screen ? 'dot dot-ok' : 'dot dot-warn'} />
          <span className="group-output-name">{o.output.name}</span>
          <span className="dim">{o.screen ? strings.connected : strings.notConnected}</span>
          {o === firstConnected && <span className="badge">{strings.audioHere}</span>}
        </div>
      ))}
    </aside>
  )
}
