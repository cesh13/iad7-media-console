import { useState, type DragEvent } from 'react'
import type { ServiceItem, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'

const api = window.mediaConsole
const itemDragType = 'application/x-media-console-item'

// ---- Order ----

export function OrderPanel(props: { state: ServiceState; selectedId: string | null; onSelect: (id: string) => void }) {
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

      {/* Read the size of pictures and the length of videos once. */}
      {items
        .filter((i) => i.url && i.type !== 'slides' && (i.width === undefined || (i.type === 'video' && i.duration === undefined)))
        .map((i) =>
          i.type === 'video' ? (
            <video
              key={i.id}
              className="hidden"
              preload="metadata"
              src={i.url}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget
                void api.updateItem(i.id, { width: v.videoWidth, height: v.videoHeight })
                void api.setDuration(i.id, v.duration)
              }}
            />
          ) : (
            <img
              key={i.id}
              className="hidden"
              src={i.url}
              alt=""
              onLoad={(e) => {
                const img = e.currentTarget
                void api.updateItem(i.id, { width: img.naturalWidth, height: img.naturalHeight })
              }}
            />
          )
        )}
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
        {item.cache !== 'ready' && item.cache !== 'error' && strings.cacheStates(item)}
        {item.cache === 'error' && (
          <span className="text-live" title={item.cacheError}>
            {strings.copyError}
          </span>
        )}
        {item.cache === 'ready' && item.type === 'video' && formatTime(item.duration)}
        {item.cache === 'ready' && item.type === 'slides' && strings.slideCount(item.pageUrls?.length ?? 0)}
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

export function TypeIcon({ type }: { type: ServiceItem['type'] }) {
  return (
    <span className="type-icon" title={strings.types[type]}>
      {type === 'slides' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M12 16v4M8 20h8M7 8h6M7 11h10" />
        </svg>
      ) : type === 'video' ? (
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
