import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { FolderEntry, ServiceItem } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

/** One line of the list: a subfolder or a file. */
type Row =
  | { kind: 'dir'; dir: string; name: string; depth: number; count: number }
  | { kind: 'file'; entry: FolderEntry; depth: number }

function parentOf(dir: string): string {
  const i = dir.lastIndexOf('/')
  return i < 0 ? '' : dir.slice(0, i)
}

/** The open subfolders, plus `dir` and all folders above it. */
function withParents(open: Set<string>, dir: string): Set<string> {
  const next = new Set(open)
  for (let d = dir; d; d = parentOf(d)) next.add(d)
  return next
}

/** The subfolder of the chosen file, so the list opens where that file is. */
function chosenDir(item: ServiceItem): string {
  if (!item.folderChoice?.startsWith(item.path)) return ''
  return parentOf(item.folderChoice.slice(item.path.length).replace(/\\/g, '/').replace(/^\/+/, ''))
}

/** The tree: at each level the subfolders first, then the files. Only open subfolders show their content. */
function treeRows(entries: FolderEntry[], open: Set<string>): Row[] {
  const counts = new Map<string, number>()
  for (const e of entries) {
    for (let d = e.dir; d; d = parentOf(d)) counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  const dirs = [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const rows: Row[] = []
  const addLevel = (parent: string, depth: number) => {
    for (const dir of dirs) {
      if (parentOf(dir) !== parent) continue
      rows.push({ kind: 'dir', dir, name: dir.slice(dir.lastIndexOf('/') + 1), depth, count: counts.get(dir) ?? 0 })
      if (open.has(dir)) addLevel(dir, depth + 1)
    }
    for (const entry of entries) if (entry.dir === parent) rows.push({ kind: 'file', entry, depth })
  }
  addLevel('', 0)
  return rows
}

/**
 * A folder item opened in the order (SPEC 5.2): search by number, title or
 * words in the lyrics; a list with a fixed height that scrolls inside.
 * Subfolders open in place; a search looks in all of them.
 * ↑ ↓ move, Enter chooses a file or opens a subfolder. Double-click: choose
 * and go live.
 */
export function FolderBox({ item }: { item: ServiceItem }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FolderEntry[]>([])
  const [cursor, setCursor] = useState(0)
  const [open, setOpen] = useState(() => withParents(new Set(), chosenDir(item)))
  const listRef = useRef<HTMLDivElement>(null)
  const count = item.folder?.count ?? 0
  const searching = query.trim() !== ''

  const rows = useMemo<Row[]>(
    () => (searching ? results.map((entry) => ({ kind: 'file', entry, depth: 0 })) : treeRows(results, open)),
    [results, open, searching]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      void api.searchFolder(item.id, query).then((list) => {
        setResults(list)
        setCursor(0)
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [query, item.id, count])

  // Keep the cursor row visible.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.folder-entry.is-cursor')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const choose = (e: FolderEntry) => {
    setOpen((current) => withParents(current, e.dir))
    void api.chooseInFolder(item.id, e.path)
  }

  const toggle = (dir: string) => {
    const next = new Set(open)
    if (next.has(dir)) next.delete(dir)
    else next.add(dir)
    setOpen(next)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setCursor((c) => Math.max(0, Math.min(rows.length - 1, c + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter' && rows[cursor]) {
      e.preventDefault()
      e.stopPropagation()
      const row = rows[cursor]
      if (row.kind === 'dir') toggle(row.dir)
      else choose(row.entry)
    }
  }

  return (
    <div className="folder-box" onClick={(e) => e.stopPropagation()}>
      <input
        className="input folder-search"
        value={query}
        autoFocus
        placeholder={strings.folderSearchPlaceholder}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
      />
      <div className="folder-list" ref={listRef} data-own-keys>
        {rows.length === 0 && <div className="dim small folder-empty">{strings.folderNoResults}</div>}
        {rows.map((row, i) => {
          const paddingLeft = 8 + row.depth * 14
          if (row.kind === 'dir') {
            return (
              <div
                key={`dir:${row.dir}`}
                className={['folder-entry', 'folder-dir', i === cursor ? 'is-cursor' : ''].join(' ')}
                style={{ paddingLeft }}
                onMouseEnter={() => setCursor(i)}
                onClick={() => toggle(row.dir)}
              >
                <span className="chevron">{open.has(row.dir) ? '▾' : '▸'}</span>
                <span className="folder-title">{row.name}/</span>
                <span className="dim small">{row.count}</span>
              </div>
            )
          }
          const e = row.entry
          return (
            <div
              key={e.path}
              className={[
                'folder-entry',
                i === cursor ? 'is-cursor' : '',
                e.path === item.folderChoice ? 'is-chosen' : ''
              ].join(' ')}
              style={{ paddingLeft }}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(e)}
              onDoubleClick={() => {
                choose(e)
                // Go live once the file is ready (copied and converted).
                void api.goLive(item.id)
              }}
            >
              <span className="mono folder-num">{e.number ?? ''}</span>
              <span className="folder-title">
                {e.title}
                {searching && e.dir && <span className="folder-snippet">{e.dir}</span>}
                {e.snippet && searching && !/^\d+$/.test(query.trim()) && <span className="folder-snippet">{e.snippet}</span>}
              </span>
              {e.path === item.folderChoice && <span className="status-done">✓</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
