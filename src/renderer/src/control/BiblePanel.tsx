import type React from 'react'
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { bookCategories, bookName, books, refLabel } from '../../../shared/bibleBooks'
import type { BibleHit, BibleRef, ServiceState, TextLayer } from '../../../shared/types'
import { strings } from '../strings'
import { BibleCatalog } from './BibleCatalog'
import { TextStyleDialog } from './TextStyleDialog'

const api = window.mediaConsole

type Step = 'books' | 'chapters' | 'verses'

export type Bible = ReturnType<typeof useBible>

/**
 * Bible tab (SPEC 5.5): search by reference or words, and a picker
 * book → chapter → verse. Search and picker share one state. The state lives
 * in ServicePage, so it stays the same when the operator switches tabs.
 */
export function useBible(bibles: ServiceState['bibles']) {
  const [versionId, setVersionId] = useState<string>(bibles[0]?.id ?? '')
  const version = bibles.find((b) => b.id === versionId) ?? bibles[0]
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>('books')
  const [book, setBook] = useState(19)
  const [chapter, setChapter] = useState(23)
  const [sel, setSel] = useState<{ from: number; to: number }>({ from: 1, to: 1 })
  const [verses, setVerses] = useState<string[]>([])
  const [hits, setHits] = useState<{ list: BibleHit[]; more: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!version && bibles[0]) setVersionId(bibles[0].id)
  }, [bibles.length])

  const chapterCount = (b: number) => version?.verseCounts[b - 1]?.length ?? 0
  const verseCount = version?.verseCounts[book - 1]?.[chapter - 1] ?? 0

  // Load the text of the chapter.
  useEffect(() => {
    if (!version) return
    void api.getChapter(version.id, book, chapter).then(setVerses)
  }, [version?.id, book, chapter])

  const ref: BibleRef | null = version ? { bibleId: version.id, book, chapter, from: sel.from, to: sel.to } : null

  const pickBook = (n: number) => {
    setBook(n)
    setChapter(1)
    setSel({ from: 1, to: 1 })
    setStep(chapterCount(n) === 1 ? 'verses' : 'chapters')
  }
  const pickChapter = (c: number) => {
    setChapter(c)
    setSel({ from: 1, to: 1 })
    setStep('verses')
  }
  const pickVerse = (v: number, e?: MouseEvent) => {
    if (e?.shiftKey) setSel({ from: Math.min(sel.from, v), to: Math.max(sel.from, v) })
    else setSel({ from: v, to: v })
  }
  /** Open a passage at the verse step (a "Today" chip or a search hit). */
  const goTo = (r: { book: number; chapter: number; from: number; to: number }) => {
    setBook(r.book)
    setChapter(r.chapter)
    setSel({ from: r.from, to: r.to })
    setStep('verses')
  }
  const goChapter = (delta: number) => {
    const c = chapter + delta
    if (c >= 1 && c <= chapterCount(book)) {
      setChapter(c)
      setSel({ from: 1, to: 1 })
    } else if (delta > 0 && book < 66) {
      setBook(book + 1)
      setChapter(1)
      setSel({ from: 1, to: 1 })
    } else if (delta < 0 && book > 1) {
      setBook(book - 1)
      setChapter(chapterCount(book - 1))
      setSel({ from: 1, to: 1 })
    }
  }

  const runSearch = async (text: string) => {
    if (!version || !text.trim()) {
      setHits(null)
      return
    }
    const result = await api.searchBible(version.id, text)
    if (result.kind === 'ref') {
      setHits(null)
      setBook(result.book)
      if (!result.chapter) {
        setStep(chapterCount(result.book) === 1 ? 'verses' : 'chapters')
        return
      }
      setChapter(result.chapter)
      const count = version.verseCounts[result.book - 1]?.[result.chapter - 1] ?? 1
      // "sal 23" = the whole chapter; "sal 23:4" = one verse; "sal 23:1-4" = a range.
      const from = result.from ?? 1
      const to = Math.min(result.to ?? (result.from ? result.from : count), count)
      setSel({ from, to })
      setStep('verses')
    } else if (result.kind === 'words') {
      setHits({ list: result.hits, more: result.more })
    } else {
      setHits({ list: [], more: false })
    }
  }

  // Search while typing (a short wait, so it does not run on every key).
  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query), 250)
    return () => clearTimeout(timer)
  }, [query, version?.id])

  /** Put the cursor in the search input, with its text selected (Ctrl+B). */
  const focusSearch = () => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  return {
    bibles,
    version,
    setVersionId,
    query,
    setQuery,
    step,
    setStep,
    book,
    chapter,
    setChapter,
    sel,
    setSel,
    verses,
    hits,
    setHits,
    error,
    setError,
    searchRef,
    listRef,
    ref,
    chapterCount,
    verseCount,
    pickBook,
    pickChapter,
    pickVerse,
    goTo,
    goChapter,
    runSearch,
    focusSearch
  }
}

/** Left column of the Bible tab: search, version, picker, "Today" chips, tools. */
export function BibleSide({ state, bible }: { state: ServiceState; bible: Bible }) {
  const { book, chapter, sel, step, version } = bible
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const typed = useRef({ text: '', at: 0 })
  const dialogs = (
    <>
      {catalogOpen && <BibleCatalog installed={bible.bibles} onClose={() => setCatalogOpen(false)} />}
      {styleOpen && <TextStyleDialog state={state} kind="bible" onClose={() => setStyleOpen(false)} />}
    </>
  )

  const doImport = async () => {
    bible.setError(await api.importBible())
  }
  // Drop a Bible file on the column to import it.
  const dropProps = {
    onDragOver: (e: React.DragEvent) => e.dataTransfer.types.includes('Files') && e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      const file = e.dataTransfer.files[0]
      if (!file) return
      e.preventDefault()
      void api.importBibleFrom(api.pathForFile(file)).then(bible.setError)
    }
  }

  if (bible.bibles.length === 0) {
    return (
      <div className="bible-side" {...dropProps}>
        <p className="help">{strings.noBible}</p>
        <div className="button-row">
          <button className="btn btn-primary" onClick={() => setCatalogOpen(true)}>
            {strings.downloadVersion}
          </button>
          <button className="btn" onClick={() => void doImport()}>
            {strings.importBible}
          </button>
        </div>
        {bible.error && <p className="text-live">{bible.error}</p>}
        {dialogs}
      </div>
    )
  }

  /** Type a number to jump to a chapter or verse ("23"). */
  const onPickerKey = (e: KeyboardEvent) => {
    if (!/^\d$/.test(e.key) || step === 'books') return
    const now = Date.now()
    const text = now - typed.current.at < 900 ? typed.current.text + e.key : e.key
    typed.current = { text, at: now }
    const n = Number(text)
    if (step === 'chapters' && n >= 1 && n <= bible.chapterCount(book)) bible.setChapter(n)
    if (step === 'verses' && n >= 1 && n <= bible.verseCount) bible.setSel({ from: n, to: n })
  }

  const stepLabels: [Step, string][] = [
    ['books', strings.stepBook],
    ['chapters', strings.stepChapter],
    ['verses', strings.stepVerse]
  ]
  const liveText = liveTextOf(state)

  return (
    <div className="bible-side" {...dropProps}>
      <div className="bible-search-row">
        <input
          ref={bible.searchRef}
          className="input bible-search"
          value={bible.query}
          placeholder={strings.bibleSearchPlaceholder}
          onChange={(e) => bible.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void bible.runSearch(bible.query)
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              bible.listRef.current?.focus()
            }
          }}
        />
        <select className="input select" value={version?.id} onChange={(e) => bible.setVersionId(e.target.value)}>
          {bible.bibles.map((b) => (
            <option key={b.id} value={b.id} title={b.name}>
              {b.abbrev}
            </option>
          ))}
        </select>
      </div>
      {bible.error && <p className="text-live small">{bible.error}</p>}

      <div className="picker" tabIndex={0} onKeyDown={onPickerKey}>
        <div className="picker-steps">
          {stepLabels.map(([id, label], i) => (
            <button key={id} className={step === id ? 'step is-on' : 'step'} onClick={() => bible.setStep(id)}>
              {i + 1}. {label}
            </button>
          ))}
        </div>
        <div className="picker-area">
          {step === 'books' && <BookGrid current={book} onPick={bible.pickBook} />}
          {step === 'chapters' && (
            <>
              <span className="label-inline">{strings.pickChapter(bookName(book), bible.chapterCount(book))}</span>
              <NumberGrid
                count={bible.chapterCount(book)}
                isOn={(n) => n === chapter}
                onPick={(n) => bible.pickChapter(n)}
              />
            </>
          )}
          {step === 'verses' && (
            <>
              <span className="label-inline">{strings.pickVerse(bookName(book), chapter)}</span>
              <NumberGrid count={bible.verseCount} isOn={(n) => n >= sel.from && n <= sel.to} onPick={bible.pickVerse} />
            </>
          )}
        </div>
        <span className="dim small">{strings.pickerHelp}</span>
      </div>

      {state.bibleHistory.length > 0 && (
        <div className="bible-today">
          <span className="label-inline">{strings.today}</span>
          {state.bibleHistory.slice(0, 6).map((r) => {
            const isLive = liveText?.ref && liveText.title === refLabel(r)
            return (
              <button key={refLabel(r)} className={isLive ? 'chip chip-live' : 'chip'} onClick={() => bible.goTo(r)}>
                {refLabel(r)}
              </button>
            )
          })}
        </div>
      )}

      <div className="bible-tools">
        <button className="btn btn-small btn-quiet" onClick={() => setStyleOpen(true)}>
          {strings.textStyleButton}
        </button>
        <button className="btn btn-small btn-quiet" title={strings.downloadVersionHint} onClick={() => setCatalogOpen(true)}>
          {strings.downloadShort}
        </button>
        <button className="btn btn-small btn-quiet" title={strings.importBibleHint} onClick={() => void doImport()}>
          {strings.importShort}
        </button>
      </div>
      {dialogs}
    </div>
  )
}

/** Center of the Bible tab: location bar, Add to order / Show now, and the verse list. */
export function BibleMain({ state, bible }: { state: ServiceState; bible: Bible }) {
  const { book, chapter, sel, ref, hits } = bible
  if (bible.bibles.length === 0) {
    return (
      <section className="panel bible-main">
        <p className="help">{strings.bibleEmptyMain}</p>
      </section>
    )
  }

  // The Bible text live in the target, if it is this chapter.
  const liveText = liveTextOf(state)
  const liveHere = liveText?.ref && liveText.ref.book === book && liveText.ref.chapter === chapter ? liveText : null
  const liveVerse = liveHere?.screens[liveHere.index]?.verse

  /**
   * ↑ ↓ in the verse list. While this passage is live: the next or previous
   * screen, from the verse that is live. Otherwise: move the selection verse by verse.
   */
  const onListKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const delta = e.key === 'ArrowDown' ? 1 : -1
    if (liveHere) return void api.pageStep(delta)
    const v = Math.max(1, Math.min(bible.verseCount, sel.from + delta))
    bible.setSel({ from: v, to: v })
  }

  // Keep the live verse in view while it moves.
  useEffect(() => {
    bible.listRef.current?.querySelector('.verse-row.is-live')?.scrollIntoView({ block: 'nearest' })
  }, [liveVerse])

  return (
    <section className="panel bible-main">
      <div className="bible-loc">
        <button className="btn btn-icon" aria-label={strings.prevChapter} onClick={() => bible.goChapter(-1)}>
          ‹
        </button>
        <nav className="crumbs">
          <a onClick={() => bible.setStep('books')}>{strings.crumbBooks}</a>
          <span>›</span>
          <a onClick={() => bible.setStep(bible.chapterCount(book) === 1 ? 'verses' : 'chapters')}>{bookName(book)}</a>
          <span>›</span>
          <a onClick={() => bible.setStep('verses')}>{chapter}</a>
          <span>›</span>
          <b>{sel.from === sel.to ? sel.from : `${sel.from}-${sel.to}`}</b>
        </nav>
        <button className="btn btn-icon" aria-label={strings.nextChapter} onClick={() => bible.goChapter(1)}>
          ›
        </button>
        <div className="spacer" />
        <button className="btn" disabled={!ref} onClick={() => ref && void api.addBibleToOrder(ref)}>
          {strings.addToOrder}
        </button>
        <button
          className="btn btn-live"
          disabled={!ref}
          onClick={() => {
            if (!ref) return
            void api.showBibleNow(ref)
            // The arrow keys work on the verse list right away.
            bible.listRef.current?.focus()
          }}
        >
          {strings.showNow}
        </button>
      </div>

      <div className="verse-list" ref={bible.listRef} tabIndex={0} data-own-keys onKeyDown={onListKey}>
        {hits ? (
          <>
            <span className="label-inline">{strings.searchResults(hits.list.length, hits.more)}</span>
            {hits.list.map((h) => (
              <button
                key={`${h.book}-${h.chapter}-${h.verse}`}
                className="verse-row"
                onClick={() => {
                  bible.goTo({ book: h.book, chapter: h.chapter, from: h.verse, to: h.verse })
                  bible.setHits(null)
                }}
              >
                <span className="mono verse-num">{refLabel({ book: h.book, chapter: h.chapter, from: h.verse })}</span>
                <span className="verse-line">{h.text}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <span className="label-inline">{strings.versesOf(bookName(book), chapter)}</span>
            {bible.verses.map((text, i) => {
              const n = i + 1
              const cls = ['verse-row']
              if (n === liveVerse) cls.push('is-live')
              else if (n >= sel.from && n <= sel.to) cls.push('is-selected')
              return (
                <button
                  key={n}
                  className={cls.join(' ')}
                  onClick={(e) => bible.pickVerse(n, e)}
                  onDoubleClick={() => (liveHere ? void api.showVerse(n) : ref && void api.showBibleNow(ref, n))}
                >
                  <span className="mono verse-num">
                    {chapter}:{n}
                  </span>
                  <span className="verse-line">{text}</span>
                  {n === liveVerse && <span className="tag tag-live">{strings.badgeLive}</span>}
                </button>
              )
            })}
          </>
        )}
      </div>
    </section>
  )
}

/** The Bible text live in the target group (or the first group, for "all"). Songs have no passage. */
function liveTextOf(state: ServiceState): TextLayer | null {
  const groups = state.target === 'all' ? state.groups : state.groups.filter((g) => g.config.id === state.target)
  return groups.map((g) => g.live.text).find((t) => t?.ref) ?? null
}

function BookGrid({ current, onPick }: { current: number; onPick: (n: number) => void }) {
  const grid = (testament: 'ot' | 'nt') => (
    <div className="book-grid">
      {books
        .filter((b) => b.testament === testament)
        .map((b) => {
          const c = bookCategories[b.cat]
          const on = b.n === current
          return (
            <button
              key={b.n}
              className={on ? 'book is-on' : 'book'}
              title={b.name}
              style={on ? undefined : { background: c.bg, color: c.fg, borderColor: c.bg }}
              onClick={() => onPick(b.n)}
            >
              {b.abbr}
            </button>
          )
        })}
    </div>
  )
  return (
    <div className="books">
      <span className="label-inline">{strings.oldTestament}</span>
      {grid('ot')}
      <span className="label-inline">{strings.newTestament}</span>
      {grid('nt')}
      <div className="legend">
        {Object.values(bookCategories).map((c) => (
          <span key={c.name}>
            <i style={{ background: c.bg, borderColor: c.fg }} />
            {c.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function NumberGrid(props: { count: number; isOn: (n: number) => boolean; onPick: (n: number, e: MouseEvent) => void }) {
  return (
    <div className="number-grid">
      {Array.from({ length: props.count }, (_, i) => i + 1).map((n) => (
        <button key={n} className={props.isOn(n) ? 'num is-on' : 'num'} onClick={(e) => props.onPick(n, e)}>
          {n}
        </button>
      ))}
    </div>
  )
}
