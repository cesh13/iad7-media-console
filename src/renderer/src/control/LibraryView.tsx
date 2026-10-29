import { useEffect, useMemo, useState } from 'react'
import type { Favorite, ItemType, LibEntry, ServiceItem, ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { TypeIcon } from './OrderPanel'

const api = window.mediaConsole

/** What the Library tab shows: a library folder, ★ Favorites, or a past service. */
export type LibSelection = { kind: 'folder'; root: string } | { kind: 'favorites' } | { kind: 'service'; id: string } | null

export const pathDragType = 'application/x-media-console-path'

/** Left side of the Library tab: root folders, ★ Favorites, past services (SPEC 5.2). */
export function LibrarySide(props: { state: ServiceState; selection: LibSelection; onSelect: (s: LibSelection) => void }) {
  const { state, selection, onSelect } = props
  const past = state.services.filter((s) => s.id !== state.service.id)
  return (
    <div className="lib-side">
      <span className="label">{strings.libraryFolders}</span>
      <button
        className={selection?.kind === 'favorites' ? 'lib-root is-on' : 'lib-root'}
        onClick={() => onSelect({ kind: 'favorites' })}
      >
        <span className="star">★</span>
        <span className="row-title">{strings.favorites}</span>
        <span className="dim small">{state.favorites.length}</span>
      </button>
      {state.library.map((f) => (
        <div key={f.path} className={selection?.kind === 'folder' && selection.root === f.path ? 'lib-root is-on' : 'lib-root'}>
          <button className="lib-root-main" onClick={() => onSelect({ kind: 'folder', root: f.path })} title={f.path}>
            <TypeIcon type="folder" />
            <span className="row-title">{f.name}</span>
          </button>
          <button className="btn btn-small btn-quiet" title={strings.removeLibraryFolder} onClick={() => void api.removeLibraryFolder(f.path)}>
            ✕
          </button>
        </div>
      ))}
      <button className="btn btn-small btn-quiet lib-add" onClick={() => void api.pickLibraryFolder()}>
        + {strings.addLibraryFolder}
      </button>

      <span className="label lib-past-label">{strings.pastServices}</span>
      {past.length === 0 && <span className="dim small">{strings.noPastServices}</span>}
      {past.map((s) => (
        <button
          key={s.id}
          className={selection?.kind === 'service' && selection.id === s.id ? 'lib-root is-on' : 'lib-root'}
          onClick={() => onSelect({ kind: 'service', id: s.id })}
        >
          <span className="row-title">{s.name}</span>
          <span className="dim small">{strings.itemCount(s.items)}</span>
        </button>
      ))}
    </div>
  )
}

/** Center of the Library tab: the browser and the details panel. */
export function LibraryMain(props: { state: ServiceState; selection: LibSelection; onOpenInPreview: (path: string) => void }) {
  const { state, selection } = props
  if (!selection) return <section className="panel lib-main"><p className="help">{strings.libraryHelp}</p></section>
  if (selection.kind === 'favorites') return <FavoritesView state={state} />
  if (selection.kind === 'service') return <PastServiceView state={state} id={selection.id} />
  return <FolderBrowser key={selection.root} state={state} root={selection.root} onOpenInPreview={props.onOpenInPreview} />
}

const filters: { label: string; types: ItemType[] | null }[] = [
  { label: 'All', types: null },
  { label: 'Video', types: ['video'] },
  { label: 'Slides', types: ['slides'] },
  { label: 'Songs', types: ['song'] },
  { label: 'Images', types: ['image'] },
  { label: 'Audio', types: ['audio'] }
]
type Sort = 'name' | 'used' | 'added'

function FolderBrowser({ state, root, onOpenInPreview }: { state: ServiceState; root: string; onOpenInPreview: (path: string) => void }) {
  const [path, setPath] = useState(root)
  const [entries, setEntries] = useState<LibEntry[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(0)
  const [sort, setSort] = useState<Sort>('name')
  const [selected, setSelected] = useState<LibEntry | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      void (query.trim() ? api.searchLibrary(path, query) : api.listLibrary(path)).then(setEntries)
    }, 150)
    return () => clearTimeout(timer)
  }, [path, query])

  const shown = useMemo(() => {
    const types = filters[filter].types
    const list = entries.filter((e) => e.dir || !types || (e.type && types.includes(e.type)))
    const files = list.filter((e) => !e.dir)
    if (sort === 'used') files.sort((a, b) => (b.used?.last ?? 0) - (a.used?.last ?? 0))
    if (sort === 'added') files.sort((a, b) => b.mtime - a.mtime)
    return [...list.filter((e) => e.dir), ...files]
  }, [entries, filter, sort])

  // Path bar: the root, then each folder below it.
  const rel = path.slice(root.length).split(/[\\/]/).filter(Boolean)
  const crumbs = [{ name: root.split(/[\\/]/).filter(Boolean).pop() ?? root, path: root }]
  rel.forEach((name, i) => crumbs.push({ name, path: [root, ...rel.slice(0, i + 1)].join('\\') }))

  const dirFiles = shown.filter((e) => !e.dir).map((e) => e.path)
  const isFavorite = (p: string) => state.favorites.some((f) => f.path === p)

  return (
    <section className="panel lib-main">
      <div className="lib-toolbar">
        <nav className="crumbs">
          {crumbs.map((c, i) => (
            <span key={c.path} className="crumb">
              {i > 0 && <span>›</span>}
              {i < crumbs.length - 1 ? <a onClick={() => setPath(c.path)}>{c.name}</a> : <b>{c.name}</b>}
            </span>
          ))}
        </nav>
        <span className="dim small">{strings.fileCount(entries.filter((e) => !e.dir).length)}</span>
        <div className="spacer" />
        <input className="input lib-search" value={query} placeholder={strings.searchLibrary} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="lib-toolbar">
        <div className="chips">
          {filters.map((f, i) => (
            <button key={f.label} className={filter === i ? 'chip is-on' : 'chip'} onClick={() => setFilter(i)}>
              {strings.libFilters[f.label] ?? f.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span className="label-inline">{strings.sortLabel}</span>
        <select className="input select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="name">{strings.sortName}</option>
          <option value="used">{strings.sortUsed}</option>
          <option value="added">{strings.sortAdded}</option>
        </select>
        <button className="btn btn-small" disabled={dirFiles.length === 0} onClick={() => void api.addFiles(dirFiles)}>
          + {strings.addAllToOrder}
        </button>
      </div>

      <div className="lib-body">
        <div className="tiles" onKeyDown={(e) => e.key === 'Enter' && selected && !selected.dir && void api.addFiles([selected.path])} tabIndex={0}>
          {shown.length === 0 && <p className="dim small">{strings.libEmpty}</p>}
          {shown.map((e) => (
            <div
              key={e.path}
              className={['tile', e.dir ? 'tile-dir' : '', selected?.path === e.path ? 'is-on' : ''].join(' ')}
              draggable={!e.dir}
              onDragStart={(ev) => ev.dataTransfer.setData(pathDragType, e.path)}
              onClick={() => setSelected(e)}
              onDoubleClick={() => (e.dir ? setPath(e.path) : void api.addFiles([e.path]))}
            >
              <div className={`tile-thumb thumb-${e.type ?? 'folder'}`}>
                <TypeIcon type={e.dir ? 'folder' : e.type!} />
                {!e.dir && <span className="tile-type">{strings.types[e.type!].toUpperCase()}</span>}
              </div>
              <span className="tile-name" title={e.name}>
                {e.dir ? `${e.name}/` : e.name}
              </span>
              <span className="dim small">{e.dir ? strings.dirHint(e.files ?? 0) : strings.usedText(e.used)}</span>
            </div>
          ))}
        </div>
        <Details entry={selected} favorite={selected ? isFavorite(selected.path) : false} onOpenInPreview={onOpenInPreview} />
      </div>
      <span className="dim small">{strings.libTip}</span>
    </section>
  )
}

function Details({ entry, favorite, onOpenInPreview }: { entry: LibEntry | null; favorite: boolean; onOpenInPreview: (path: string) => void }) {
  if (!entry || entry.dir) return <div className="lib-details dim small">{strings.libSelectHint}</div>
  return (
    <div className="lib-details">
      <span className="selected-title">{entry.name}</span>
      <div className="kv">
        <span className="label-inline">{strings.typeLabel}</span>
        <span>{strings.types[entry.type!]}</span>
      </div>
      <div className="kv">
        <span className="label-inline">{strings.sizeLabel}</span>
        <span className="mono">{formatSize(entry.size)}</span>
      </div>
      <div className="kv">
        <span className="label-inline">{strings.addedLabel}</span>
        <span>{new Date(entry.mtime).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <div className="kv">
        <span className="label-inline">{strings.lastUsedLabel}</span>
        <span>{strings.usedText(entry.used)}</span>
      </div>
      <div className="button-col">
        <button className="btn btn-primary" onClick={() => void api.addFiles([entry.path])}>
          {strings.addToOrder}
        </button>
        <button className="btn" onClick={() => onOpenInPreview(entry.path)}>
          {strings.openInPreview}
        </button>
        <button className="btn" disabled={favorite} onClick={() => void api.addFavorite(entry.path)}>
          {favorite ? `★ ${strings.inFavorites}` : `☆ ${strings.addToFavorites}`}
        </button>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`
}

/** ★ Favorites: files and actions; give each one a hotkey F1–F8 (SPEC 5.6). */
function FavoritesView({ state }: { state: ServiceState }) {
  return (
    <section className="panel lib-main">
      <div className="lib-toolbar">
        <b>★ {strings.favorites}</b>
        <span className="dim small">{strings.favoritesHelp}</span>
      </div>
      <div className="fav-list">
        {state.favorites.map((f) => (
          <FavoriteRow key={f.id} favorite={f} />
        ))}
      </div>
      <div className="button-row tight">
        <span className="label-inline">{strings.addAction}</span>
        <button className="btn btn-small" onClick={() => void api.addFavoriteAction('logo')}>
          + {strings.logo}
        </button>
        <button className="btn btn-small" onClick={() => void api.addFavoriteAction('black')}>
          + {strings.blackShort}
        </button>
        <button className="btn btn-small" onClick={() => void api.addFavoriteAction('countdown')}>
          + {strings.countdown5}
        </button>
      </div>
    </section>
  )
}

function FavoriteRow({ favorite: f }: { favorite: Favorite }) {
  return (
    <div className="fav-row">
      {f.kind === 'file' && f.type ? <TypeIcon type={f.type} /> : <span className="star">★</span>}
      <span className="row-title" title={f.path}>
        {f.title}
      </span>
      <select
        className="input select select-small"
        value={f.hotkey ?? ''}
        onChange={(e) => void api.setHotkey(f.id, e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">{strings.noHotkey}</option>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
          <option key={k} value={k}>
            F{k}
          </option>
        ))}
      </select>
      {f.kind === 'file' && f.path && (
        <button className="btn btn-small" onClick={() => void api.addFiles([f.path!])}>
          + {strings.addToOrder}
        </button>
      )}
      <button className="btn btn-small btn-quiet" onClick={() => void api.removeFavorite(f.id)}>
        ✕
      </button>
    </div>
  )
}

/** "Reuse a past service": look at its order, then copy it to this service. */
function PastServiceView({ state, id }: { state: ServiceState; id: string }) {
  const [items, setItems] = useState<ServiceItem[]>([])
  useEffect(() => void api.serviceItems(id).then(setItems), [id])
  const summary = state.services.find((s) => s.id === id)
  return (
    <section className="panel lib-main">
      <div className="lib-toolbar">
        <b>{summary?.name}</b>
        <span className="dim small">{strings.itemCount(items.length)}</span>
      </div>
      <p className="help">{strings.reuseHelp(summary?.name ?? '')}</p>
      <div className="past-list">
        {items.map((i) => (
          <div key={i.id} className="past-row">
            <TypeIcon type={i.type} />
            <span className="row-title">{i.title}</span>
            {i.type === 'folder' && <span className="dim small">{strings.folderKept}</span>}
          </div>
        ))}
      </div>
      <div className="button-row">
        <button className="btn btn-primary" disabled={items.length === 0} onClick={() => void api.copyOrderFrom(id)}>
          {strings.copyOrder}
        </button>
        <button className="btn" onClick={() => void api.openService(id)}>
          {strings.openThisService}
        </button>
      </div>
    </section>
  )
}
