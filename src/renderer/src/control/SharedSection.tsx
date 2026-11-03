import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import type { ServiceState, SharedEntry, SharedState } from '../../../shared/types'
import { strings } from '../strings'
import { TypeIcon } from './OrderPanel'

const api = window.mediaConsole

/**
 * The shared folder at the end of the order (SPEC 5.2): files and subfolders
 * that other people put on the network share. New files have a dot.
 * Subfolders open in place; "All" adds all their files in file-name order.
 */
const statusLook: Record<SharedState['status'], { css: string; dot: string; label: string }> = {
  off: { css: '', dot: 'dot-none', label: '' },
  scanning: { css: 'dim', dot: 'dot-warn', label: strings.scanning },
  watching: { css: 'ok', dot: 'dot-ok', label: strings.watching },
  unreachable: { css: 'bad', dot: 'dot-live', label: strings.unreachable },
  tooBig: { css: 'bad', dot: 'dot-live', label: strings.tooBig }
}

/** The text under the folder path when no file is listed. */
const emptyText: Record<SharedState['status'], string> = {
  off: '',
  scanning: strings.sharedScanning,
  watching: strings.sharedEmpty,
  unreachable: strings.sharedRetry,
  tooBig: strings.sharedTooBig
}

/** Smallest height the section can be dragged to, in pixels. */
const minHeight = 90
/** Space always left for the order list above the section, in pixels. */
const orderSpace = 120

/** Collapsed or not, and the dragged height, are kept on this computer only. */
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writePref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not saved; the section still works.
  }
}

export function SharedSection({ state }: { state: ServiceState }) {
  const [shared, setShared] = useState<SharedState | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pathText, setPathText] = useState('')
  const [collapsed, setCollapsed] = useState(() => readPref('shared.collapsed') === '1')
  // null: the normal size (fits the content, at most half of the column).
  const [height, setHeight] = useState<number | null>(() => Number(readPref('shared.height')) || null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.getShared().then(setShared)
    return api.onSharedChanged(setShared)
  }, [])

  useEffect(() => writePref('shared.collapsed', collapsed ? '1' : null), [collapsed])
  useEffect(() => writePref('shared.height', height === null ? null : String(Math.round(height))), [height])

  if (!shared) return null
  const inOrder = new Set(state.service.items.flatMap((i) => [i.path, i.child?.path].filter(Boolean) as string[]))
  const newCount = shared.entries.filter((e) => e.isNew).length

  /** Drag the top edge: up makes the section taller, down makes it shorter. */
  const startResize = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const box = boxRef.current
    if (!box || ev.button !== 0) return
    ev.preventDefault()
    const handle = ev.currentTarget
    const startY = ev.clientY
    const startHeight = box.getBoundingClientRect().height
    const maxHeight = Math.max(minHeight, (box.parentElement?.clientHeight ?? 600) - orderSpace)
    handle.setPointerCapture(ev.pointerId)
    const move = (e: PointerEvent) => {
      setHeight(Math.min(maxHeight, Math.max(minHeight, startHeight + startY - e.clientY)))
    }
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  const boxProps = {
    ref: boxRef,
    className: collapsed ? 'shared collapsed' : height !== null ? 'shared sized' : 'shared',
    style: !collapsed && height !== null ? { height } : undefined
  }

  const resizeHandle = !collapsed && (
    <div className="shared-resize" title={strings.resizeShared} onPointerDown={startResize} onDoubleClick={() => setHeight(null)} />
  )

  /** The title with the arrow; a click hides or shows the rest of the section. */
  const title = (
    <button
      className="shared-toggle"
      type="button"
      title={collapsed ? strings.expandShared : strings.collapseShared}
      onClick={() => setCollapsed(!collapsed)}
    >
      <span className="chevron">{collapsed ? '▸' : '▾'}</span>
      <span className="label">{strings.sharedLabel}</span>
    </button>
  )

  if (!shared.root) {
    return (
      <div {...boxProps}>
        {resizeHandle}
        <div className="shared-head">{title}</div>
        {!collapsed && (
          <>
            <p className="help small">{strings.sharedHelp}</p>
            <form
              className="button-row tight"
              onSubmit={(e) => {
                e.preventDefault()
                if (pathText.trim()) void api.setSharedFolder(pathText.trim())
              }}
            >
              <input
                className="input shared-path-input"
                value={pathText}
                placeholder={strings.sharedPathPlaceholder}
                onChange={(e) => setPathText(e.target.value)}
              />
              <button className="btn btn-small" type="submit">
                {strings.watch}
              </button>
              <button className="btn btn-small btn-quiet" type="button" onClick={() => void api.pickSharedFolder()}>
                {strings.chooseFolder}
              </button>
            </form>
          </>
        )}
      </div>
    )
  }

  const toggle = (rel: string) => {
    const next = new Set(open)
    if (next.has(rel)) next.delete(rel)
    else next.add(rel)
    setOpen(next)
  }

  const children = (parent: string) => shared.entries.filter((e) => e.parent === parent)

  const renderList = (parent: string, depth: number): ReactElement[] =>
    children(parent).flatMap((e) => {
      if (e.dir) {
        const files = shared.entries.filter((x) => !x.dir && (x.parent === e.rel || x.parent.startsWith(`${e.rel}/`)))
        const direct = files.filter((x) => x.parent === e.rel)
        const fresh = files.filter((x) => x.isNew).length
        const allReady = !!e.ready && files.every((x) => x.state === 'ready' || x.state === 'error')
        return [
          <div key={e.rel} className="shared-row shared-dir" style={{ paddingLeft: 6 + depth * 14 }} onClick={() => toggle(e.rel)}>
            <span className="chevron">{open.has(e.rel) ? '▾' : '▸'}</span>
            <TypeIcon type="folder" />
            <span className="shared-name">
              <span className="shared-title">{e.name}/</span>
              <span className={allReady ? 'shared-meta' : 'shared-meta warn'}>
                {strings.sharedDirState(files.length, allReady)}
              </span>
            </span>
            {fresh > 0 && <span className="badge-new">{strings.newCount(fresh)}</span>}
            <button
              className="btn btn-small"
              disabled={direct.length === 0}
              title={strings.allHint}
              onClick={(ev) => {
                ev.stopPropagation()
                void api.addSharedToOrder([e.path])
              }}
            >
              + {strings.all}
            </button>
          </div>,
          ...(open.has(e.rel) ? renderList(e.rel, depth + 1) : [])
        ]
      }
      return [<SharedFile key={e.rel} entry={e} depth={depth} inOrder={inOrder.has(e.path)} />]
    })

  return (
    <div {...boxProps}>
      {resizeHandle}
      <div className="shared-head">
        {title}
        <span className={`shared-status ${statusLook[shared.status].css}`} title={shared.error}>
          <span className={`dot ${statusLook[shared.status].dot}`} />
          {statusLook[shared.status].label}
        </span>
        <div className="spacer" />
        {/* When the list is hidden, still show that new files came in. */}
        {collapsed && newCount > 0 && <span className="badge-new">{strings.newCount(newCount)}</span>}
        <FolderMenu />
      </div>
      {!collapsed && (
        <>
          <div className="mono dim small shared-root" title={shared.root ?? undefined}>
            {shared.root}
          </div>
          {/* A second row, so the header fits in the narrow column. */}
          {newCount > 0 && (
            <div className="shared-head">
              <span className="badge-new">{strings.newCount(newCount)}</span>
              <div className="spacer" />
              <button className="btn btn-small btn-quiet" onClick={() => void api.markSharedSeen()}>
                {strings.markSeen}
              </button>
            </div>
          )}
          <div className="shared-list">
            {shared.entries.length === 0 && <p className="dim small">{emptyText[shared.status]}</p>}
            {renderList('', 0)}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * The "⋯" button with Change folder and Clear. One small button, so the header
 * fits in the narrow column. The list opens upward: the section is at the
 * bottom of the window.
 */
function FolderMenu() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div className="folder-menu" ref={box}>
      <button
        className={open ? 'btn btn-small btn-icon btn-quiet is-open' : 'btn btn-small btn-icon btn-quiet'}
        title={strings.folderMenuHint}
        aria-label={strings.folderMenuHint}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div className="add-menu-list folder-menu-list" role="menu">
          <button role="menuitem" onClick={() => choose(() => void api.pickSharedFolder())}>
            <span>{strings.changeFolder}</span>
            <span className="dim">{strings.changeFolderHint}</span>
          </button>
          <button
            role="menuitem"
            onClick={() =>
              choose(() => {
                if (window.confirm(strings.clearFolderConfirm)) void api.setSharedFolder(null)
              })
            }
          >
            <span>{strings.clearFolder}</span>
            <span className="dim">{strings.clearFolderHint}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function SharedFile({ entry: e, depth, inOrder }: { entry: SharedEntry; depth: number; inOrder: boolean }) {
  const add = () => void api.addSharedToOrder([e.path])
  return (
    <div className="shared-row" style={{ paddingLeft: 20 + depth * 14 }} onDoubleClick={add} title={e.error}>
      <span className={e.isNew ? 'dot dot-new' : 'dot dot-none'} />
      {e.type && <TypeIcon type={e.type} />}
      <span className="shared-name" title={e.error ?? e.name}>
        <span className="shared-title">{e.name}</span>
        <span className={e.state === 'error' ? 'shared-meta text-live' : 'shared-meta'}>{fileMeta(e, inOrder)}</span>
      </span>
      <button className="btn btn-small" title={strings.addToOrder} onClick={add}>
        +
      </button>
    </div>
  )
}

function fileMeta(e: SharedEntry, inOrder: boolean): string {
  const parts: string[] = []
  if (e.mtime) parts.push(strings.ago(Date.now() - e.mtime))
  if (e.state === 'ready') parts.push(inOrder ? strings.inOrder : strings.ready)
  else if (e.state === 'waiting') parts.push(strings.waiting)
  else if (e.state === 'error') parts.push(strings.copyError)
  else {
    const pct = e.progress !== undefined ? ` ${Math.round(e.progress * 100)}%` : '…'
    parts.push(`${strings.prepareStates[e.state]}${pct}`)
  }
  return parts.join(' · ')
}
