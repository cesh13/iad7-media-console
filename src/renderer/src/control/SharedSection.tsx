import { useEffect, useState, type ReactElement } from 'react'
import type { ServiceState, SharedEntry, SharedState } from '../../../shared/types'
import { strings } from '../strings'
import { TypeIcon } from './OrderPanel'

const api = window.mediaConsole

/**
 * The shared folder at the end of the order (SPEC 5.2): files and subfolders
 * that other people put on the network share. New files have a dot.
 * Subfolders open in place; "All" adds all their files in file-name order.
 */
export function SharedSection({ state }: { state: ServiceState }) {
  const [shared, setShared] = useState<SharedState | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pathText, setPathText] = useState('')

  useEffect(() => {
    void api.getShared().then(setShared)
    return api.onSharedChanged(setShared)
  }, [])

  if (!shared) return null
  const inOrder = new Set(state.service.items.flatMap((i) => [i.path, i.child?.path].filter(Boolean) as string[]))
  const newCount = shared.entries.filter((e) => e.isNew).length

  if (!shared.root) {
    return (
      <div className="shared">
        <div className="shared-head">
          <span className="label">{strings.sharedLabel}</span>
        </div>
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
              {e.name}/
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
    <div className="shared">
      <div className="shared-head">
        <span className="label">{strings.sharedLabel}</span>
        {newCount > 0 && <span className="badge-new">{strings.newCount(newCount)}</span>}
        <span className={shared.status === 'watching' ? 'shared-status ok' : 'shared-status bad'} title={shared.error}>
          <span className={shared.status === 'watching' ? 'dot dot-ok' : 'dot dot-live'} />
          {shared.status === 'watching' ? strings.watching : strings.unreachable}
        </span>
        <div className="spacer" />
        {newCount > 0 && (
          <button className="btn btn-small btn-quiet" onClick={() => void api.markSharedSeen()}>
            {strings.markSeen}
          </button>
        )}
        <button className="btn btn-small btn-quiet" title={strings.stopWatching} onClick={() => void api.setSharedFolder(null)}>
          ✕
        </button>
      </div>
      <div className="mono dim small shared-root">{shared.root}</div>
      <div className="shared-list">
        {shared.entries.length === 0 && <p className="dim small">{shared.status === 'watching' ? strings.sharedEmpty : strings.sharedRetry}</p>}
        {renderList('', 0)}
      </div>
    </div>
  )
}

function SharedFile({ entry: e, depth, inOrder }: { entry: SharedEntry; depth: number; inOrder: boolean }) {
  const add = () => void api.addSharedToOrder([e.path])
  return (
    <div className="shared-row" style={{ paddingLeft: 20 + depth * 14 }} onDoubleClick={add} title={e.error}>
      <span className={e.isNew ? 'dot dot-new' : 'dot dot-none'} />
      {e.type && <TypeIcon type={e.type} />}
      <span className="shared-name">
        {e.name}
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
