import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { HymnAudio, HymnChoice, HymnInfo, HymnalState, ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { useHymnalState } from './hooks'
import { TargetSelect } from './PreviewPanel'

const api = window.mediaConsole

export const hymnAudioKinds: HymnAudio[] = ['sung', 'instrumental', 'none']

const audioKey = 'hymnal.audio'

/** Lower case, no accents: "Señor" → "senor". */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Search by number or by words of the title. A number alone puts that hymn
 * first, then the hymns whose number starts with it. Accents and case do not matter.
 */
export function searchHymns(hymns: HymnInfo[], query: string): HymnInfo[] {
  const q = plain(query).trim()
  if (!q) return hymns
  if (/^\d+$/.test(q)) {
    const n = Number(q)
    const starts = hymns.filter((h) => h.number !== n && String(h.number).startsWith(String(n)))
    return [...hymns.filter((h) => h.number === n), ...starts]
  }
  const words = q.split(/\s+/)
  const hits = hymns.filter((h) => {
    const text = `${h.number} ${plain(h.title)}`
    return words.every((w) => text.includes(w))
  })
  // Titles that start with the text come first.
  return [...hits.filter((h) => plain(h.title).startsWith(q)), ...hits.filter((h) => !plain(h.title).startsWith(q))]
}

/** The music kind that will play: the chosen kind, or "none" when the hymn has no file of that kind. */
export function playableAudio(hymn: HymnInfo, audio: HymnAudio): HymnAudio {
  return audio !== 'none' && hymn[audio].length > 0 ? audio : 'none'
}

export type Hymnal = ReturnType<typeof useHymnal>

/**
 * Hymnal tab: search a hymn by number or title, see its slides, and send it
 * to the playlist or to the screens with its music. The state lives in
 * ServicePage, so it stays the same when the operator switches tabs.
 */
export function useHymnal() {
  const state = useHymnalState()
  const hymns = state?.hymns ?? []
  const [query, setQuery] = useState('')
  const [number, setNumber] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [track, setTrack] = useState(0)
  const [added, setAdded] = useState<number | null>(null)
  // Track only is the default (the people sing). A different choice is remembered on this computer.
  const [audio, setAudioState] = useState<HymnAudio>(() => {
    try {
      const saved = localStorage.getItem(audioKey) as HymnAudio | null
      return saved && hymnAudioKinds.includes(saved) ? saved : 'instrumental'
    } catch {
      return 'instrumental'
    }
  })
  const searchRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchHymns(hymns, query), [hymns, query])
  const selected = hymns.find((h) => h.number === number) ?? null

  const select = (n: number | null) => {
    setNumber(n)
    setPage(0)
    setTrack(0)
  }
  const search = (text: string) => {
    setQuery(text)
    // The first result is selected, so Enter acts on it at once.
    select(text.trim() ? (searchHymns(hymns, text)[0]?.number ?? null) : number)
  }
  const setAudio = (a: HymnAudio) => {
    setAudioState(a)
    setTrack(0)
    try {
      localStorage.setItem(audioKey, a)
    } catch {
      // Not saved: the choice still works until the app closes.
    }
  }

  const choice = (): HymnChoice | null =>
    selected ? { number: selected.number, audio: playableAudio(selected, audio), track: track || undefined } : null

  useEffect(() => {
    if (added === null) return
    const timer = setTimeout(() => setAdded(null), 2000)
    return () => clearTimeout(timer)
  }, [added])

  const addToOrder = () => {
    const c = choice()
    if (!c) return
    void api.addHymnToOrder(c).then((id) => id && setAdded(c.number))
  }
  const showNow = () => {
    const c = choice()
    if (!c) return
    void api.showHymnNow(c)
    // Leave the search input, so the arrow keys change the slides.
    searchRef.current?.blur()
  }

  /** Put the cursor in the search input, with its text selected (Ctrl+H). */
  const focusSearch = () => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  return { state, hymns, query, search, results, selected, select, page, setPage, audio, setAudio, track, setTrack, added, addToOrder, showNow, searchRef, focusSearch }
}

/** The hymn that is on a screen now (its slides are the content of a group), with the slide shown. */
function liveHymn(state: ServiceState, hymns: HymnInfo[]): { hymn: HymnInfo; itemId: string; page: number } | null {
  for (const g of state.groups) {
    const c = g.live.content
    const first = c?.type === 'slides' ? c.pageUrls?.[0] : undefined
    const hymn = first ? hymns.find((h) => h.pageUrls[0] === first) : undefined
    if (c && hymn) return { hymn, itemId: c.itemId, page: c.page ?? 0 }
  }
  return null
}

/** Left side of the Hymnal tab: the search, the list of hymns, and the folder. */
export function HymnalSide({ state, hymnal }: { state: ServiceState; hymnal: Hymnal }) {
  const { results, selected } = hymnal
  const listRef = useRef<HTMLDivElement>(null)
  const live = liveHymn(state, hymnal.hymns)

  // Keep the selected row visible.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.folder-entry.is-cursor')?.scrollIntoView({ block: 'nearest' })
  }, [selected?.number])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const index = results.findIndex((h) => h.number === selected?.number)
      const next = results[Math.max(0, Math.min(results.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) hymnal.select(next.number)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) hymnal.showNow()
      else {
        hymnal.addToOrder()
        hymnal.focusSearch()
      }
    }
  }

  return (
    <div className="hymnal-side">
      <input
        ref={hymnal.searchRef}
        className="input hymn-search"
        value={hymnal.query}
        placeholder={strings.hymnSearchPlaceholder}
        onChange={(e) => hymnal.search(e.target.value)}
        onKeyDown={onKey}
      />
      <span className="dim small">{strings.hymnSearchHelp}</span>
      <div className="hymn-list" ref={listRef} data-own-keys>
        {results.length === 0 && <div className="dim small folder-empty">{hymnal.state?.found ? strings.hymnNoResults : strings.hymnalEmpty}</div>}
        {results.map((h) => (
          <div
            key={h.number}
            className={['folder-entry', h.number === selected?.number ? 'is-cursor' : '', h.number === live?.hymn.number ? 'is-live' : ''].join(' ')}
            onClick={() => hymnal.select(h.number)}
            onDoubleClick={() => {
              hymnal.select(h.number)
              void api.addHymnToOrder({ number: h.number, audio: playableAudio(h, hymnal.audio) })
            }}
          >
            <span className="mono folder-num">{h.number}</span>
            <span className="folder-title">{h.title}</span>
            {h.number === live?.hymn.number ? <span className="tag tag-live">{strings.badgeLive}</span> : <span className="dim small">{h.pageUrls.length}</span>}
          </div>
        ))}
      </div>
      {hymnal.state && <HymnalFolder state={hymnal.state} />}
    </div>
  )
}

/** The hymnal folder: where it is, and the buttons to open it, change it or read it again. */
function HymnalFolder({ state }: { state: HymnalState }) {
  return (
    <div className="hymnal-foot">
      <span className="label">
        {strings.hymnalFolder} · {strings.hymnCount(state.hymns.length)}
      </span>
      <span className="dim small mono hymnal-path" title={state.root}>
        {/* The path is cut at the left, so the end of it (the folder name) shows. */}
        <bdi>{state.root}</bdi>
      </span>
      <div className="button-row">
        <button className="btn btn-small" onClick={() => void api.openHymnalFolder()}>
          {strings.hymnalOpenFolder}
        </button>
        <button className="btn btn-small" onClick={() => void api.pickHymnalFolder()}>
          {strings.hymnalChangeFolder}
        </button>
        <button className="btn btn-small btn-quiet" title={strings.hymnalRescanHint} onClick={() => void api.rescanHymnal()}>
          ↻ {strings.hymnalRescan}
        </button>
      </div>
    </div>
  )
}

/** The music of a hymn: sung, track only or none; and which file, when the hymn has more than one. */
export function HymnMusicOptions(props: {
  hymn: HymnInfo
  audio: HymnAudio
  track: number
  onAudio: (a: HymnAudio) => void
  onTrack: (t: number) => void
}) {
  const { hymn, audio, track, onAudio, onTrack } = props
  const shown = playableAudio(hymn, audio)
  const files = shown === 'none' ? [] : hymn[shown]
  return (
    <>
      <span className="label-inline">{strings.hymnMusic}</span>
      <div className="chips">
        {hymnAudioKinds.map((kind) => {
          const missing = kind !== 'none' && hymn[kind].length === 0
          return (
            <button
              key={kind}
              className={shown === kind ? 'chip is-on' : 'chip'}
              disabled={missing}
              title={missing ? strings.hymnAudioMissing : undefined}
              onClick={() => onAudio(kind)}
            >
              {strings.hymnAudio[kind]}
            </button>
          )
        })}
      </div>
      {files.length > 1 && (
        <select className="input select" title={strings.hymnTrack} value={track} onChange={(e) => onTrack(Number(e.target.value))}>
          {files.map((f, i) => (
            <option key={f} value={i}>
              {f.replace(/\.[^.]+$/, '')}
            </option>
          ))}
        </select>
      )}
    </>
  )
}

/** Center of the Hymnal tab: the slides of the chosen hymn, its music, and the buttons. */
export function HymnalMain({ state, hymnal }: { state: ServiceState; hymnal: Hymnal }) {
  const hymn = hymnal.selected
  const live = liveHymn(state, hymnal.hymns)

  if (!hymn)
    return (
      <section className="panel preview">
        <div className="preview-head">
          <h2 className="label">{strings.hymnalLabel}</h2>
          <div className="preview-title" />
          <TargetSelect state={state} />
        </div>
        <div className="preview-box preview-empty">
          <span className="dim">{hymnal.state && !hymnal.state.found ? strings.hymnalEmpty : strings.hymnChoose}</span>
        </div>
      </section>
    )

  const isLive = live?.hymn.number === hymn.number
  const page = Math.min(hymnal.page, hymn.pageUrls.length - 1)
  const kind = playableAudio(hymn, hymnal.audio)

  return (
    <section className="panel preview">
      <div className="preview-head">
        <h2 className="label">{strings.hymnalLabel}</h2>
        <div className="preview-title">
          <span className="selected-title">
            {hymn.number} · {hymn.title}
          </span>
          <span className="dim mono">
            {strings.slideCount(hymn.pageUrls.length)} · {strings.hymnMusicNote(strings.hymnAudio[kind])}
          </span>
        </div>
        <TargetSelect state={state} />
        <button className="btn btn-primary" onClick={hymnal.addToOrder}>
          {hymnal.added === hymn.number ? '✓ ' : '+ '}
          {strings.addToOrder}
        </button>
        <button className="btn btn-live" onClick={hymnal.showNow}>
          {strings.showNow}
        </button>
      </div>

      <div className="preview-box">
        <img className="hymn-page" src={hymn.pageUrls[page]} alt="" />
      </div>

      <div className="hymn-options">
        <HymnMusicOptions hymn={hymn} audio={hymnal.audio} track={hymnal.track} onAudio={hymnal.setAudio} onTrack={hymnal.setTrack} />
        {hymn.times.length === 0 && kind !== 'none' && <span className="dim small">{strings.hymnNoTimes}</span>}
      </div>

      <div className="thumbs">
        {hymn.pageUrls.map((url, i) => (
          <button
            key={url}
            className={['thumb-page', i === page ? 'is-preview' : '', isLive && i === live.page ? 'is-live' : ''].join(' ')}
            onClick={() => hymnal.setPage(i)}
            // A hymn that is live: double-click shows that slide on the screens.
            onDoubleClick={() => isLive && void api.showPage(live.itemId, i)}
          >
            <img src={url} alt="" loading="lazy" />
            <span className="thumb-num mono">{i + 1}</span>
          </button>
        ))}
      </div>
      <span className="dim small">{strings.slidesHelp}</span>
    </section>
  )
}
