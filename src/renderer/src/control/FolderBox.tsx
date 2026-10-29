import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FolderEntry, ServiceItem } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

/**
 * A folder item opened in the order (SPEC 5.2): search by number, title or
 * words in the lyrics; a list with a fixed height that scrolls inside.
 * ↑ ↓ move, Enter chooses. Double-click: choose and go live.
 */
export function FolderBox({ item }: { item: ServiceItem }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FolderEntry[]>([])
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const count = item.folder?.count ?? 0

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

  const choose = (e: FolderEntry) => void api.chooseInFolder(item.id, e.path)

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setCursor((c) => Math.max(0, Math.min(results.length - 1, c + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter' && results[cursor]) {
      e.preventDefault()
      e.stopPropagation()
      choose(results[cursor])
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
        {results.length === 0 && <div className="dim small folder-empty">{strings.folderNoResults}</div>}
        {results.map((e, i) => (
          <div
            key={e.path}
            className={[
              'folder-entry',
              i === cursor ? 'is-cursor' : '',
              e.path === item.folderChoice ? 'is-chosen' : ''
            ].join(' ')}
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
              {e.snippet && query && !/^\d+$/.test(query.trim()) && <span className="folder-snippet">{e.snippet}</span>}
            </span>
            {e.path === item.folderChoice && <span className="status-done">✓</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
