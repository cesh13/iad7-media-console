import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { ServiceItem, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { FolderBox } from './FolderBox'
import { SharedSection } from './SharedSection'

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
        <div className="button-row tight">
          <button
            className="btn btn-small btn-quiet"
            disabled={!state.undo}
            title={state.undo ? strings.undoHint(state.undo) : strings.nothingToUndo}
            onClick={() => void api.undo()}
          >
            ↶ {strings.undo}
          </button>
          <button className="btn btn-small btn-quiet" title={strings.addTextHint} onClick={() => void api.newTextItem().then(onSelect)}>
            + {strings.addText}
          </button>
          <button className="btn btn-small btn-quiet" onClick={() => void api.addCountdown()}>
            + {strings.addCountdown}
          </button>
          <button className="btn btn-small btn-quiet" title={strings.addFolderHint} onClick={() => void api.pickFolder()}>
            + {strings.addFolder}
          </button>
          <button className="btn btn-small" onClick={() => void api.pickFiles().then(showResult)}>
            + {strings.addFiles}
          </button>
        </div>
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
      {/* Fixed at the bottom of the column, under the order list. */}
      <SharedSection state={state} />

      {/* Read the size of pictures and the length of videos once. */}
      {items
        .flatMap((i) => (i.child ? [i.child] : [i]))
        .filter((i) => i.url && (i.type === 'video' || i.type === 'image' || i.type === 'audio') && (i.type === 'audio' ? i.duration === undefined : i.width === undefined || (i.type === 'video' && i.duration === undefined)))
        .map((i) =>
          i.type === 'audio' ? (
            <audio
              key={i.id}
              className="hidden"
              preload="metadata"
              src={i.url}
              onLoadedMetadata={(e) => void api.setDuration(i.id, e.currentTarget.duration)}
            />
          ) : i.type === 'video' ? (
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
  // A selected folder shows its file list. A click on the selected folder
  // row closes or opens the list. Choosing a file closes it.
  const isFolder = item.type === 'folder'
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (selected) setOpen(true)
  }, [selected])
  const chosen = item.child?.path
  const lastChosen = useRef(chosen)
  useEffect(() => {
    if (chosen && chosen !== lastChosen.current) setOpen(false)
    lastChosen.current = chosen
  }, [chosen])
  const expanded = isFolder && selected && open

  const classes = ['row', `is-${item.status}`]
  if (isNext && item.status !== 'live') classes.push('is-next')
  if (selected) classes.push('is-selected')
  if (dragOver) classes.push('is-drag-over')

  return (
    <>
      <div
        className={classes.join(' ')}
        draggable
        onClick={() => (isFolder && selected ? setOpen(!open) : onSelect())}
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
        {isFolder && (
          <span className="row-chevron" title={expanded ? strings.folderClose : strings.folderOpen}>
            {expanded ? '▾' : '▸'}
          </span>
        )}
        <span className="row-title">
          {item.title}
          {item.child && <span className="row-choice"> › {item.child.title}</span>}
        </span>
        <span className="row-meta mono">
          {item.type === 'folder' && <FolderMeta item={item} />}
          {item.cache !== 'ready' && item.cache !== 'error' && strings.cacheStates(item)}
          {item.cache === 'error' && (
            <span className="text-live" title={item.cacheError}>
              {strings.copyError}
            </span>
          )}
          {item.cache === 'ready' && (item.type === 'video' || item.type === 'audio') && formatTime(item.duration)}
          {item.cache === 'ready' && item.type === 'slides' && strings.slideCount(item.pageUrls?.length ?? 0)}
          {item.type === 'bible' && item.bible && strings.verseCount(item.bible.to - item.bible.from + 1)}
          {item.type === 'song' && item.stanzas && strings.stanzaCount(item.stanzas.length)}
        {item.type === 'countdown' &&
          (item.settings.countdownMode === 'until' ? `→ ${item.settings.untilTime || '--:--'}` : formatTime(item.settings.countdownSeconds))}
        </span>
        {/* No quick remove for the live item: removing it clears the screens. */}
        {item.status !== 'live' && (
          <button
            className="row-remove"
            title={strings.removeFromOrder}
            aria-label={strings.removeFromOrder}
            onClick={(e) => {
              e.stopPropagation()
              void api.removeItem(item.id)
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            ×
          </button>
        )}
      </div>
      {expanded && <FolderBox item={item} />}
    </>
  )
}

/** Folder row: the chosen file state, or the number of files (and the index progress). */
function FolderMeta({ item }: { item: ServiceItem }) {
  const child = item.child
  if (child && child.cache === 'error') return <span className="text-live" title={child.cacheError}>{strings.copyError}</span>
  if (child && child.cache !== 'ready') return <>{strings.cacheStates(child)}</>
  if (child?.type === 'slides') return <>{strings.slideCount(child.pageUrls?.length ?? 0)}</>
  if (child?.type === 'video') return <>{formatTime(child.duration)}</>
  const f = item.folder
  if (f?.progress != null) return <>{strings.indexing(f.progress)}</>
  return <>{strings.fileCount(f?.count ?? 0)}</>
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
      {type === 'countdown' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2M9 2h6" />
        </svg>
      ) : type === 'audio' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 9v6h4l5 4V5L8 9z" />
          <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
        </svg>
      ) : type === 'folder' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        </svg>
      ) : type === 'song' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </svg>
      ) : type === 'bible' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
          <path d="M4 19V5" />
        </svg>
      ) : type === 'slides' ? (
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
