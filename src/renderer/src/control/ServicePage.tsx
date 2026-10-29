import { useEffect, useState } from 'react'
import type { ContentLayer, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { useScreensState, useServiceState } from './hooks'
import { BibleMain, BibleSide, useBible } from './BiblePanel'
import { LibraryMain, LibrarySide, pathDragType, type LibSelection } from './LibraryView'
import { OrderPanel, TypeIcon } from './OrderPanel'
import { PreviewPanel } from './PreviewPanel'
import { QuickPanel } from './QuickPanel'
import { ScreensColumn } from './ScreensColumn'

const api = window.mediaConsole

/** Order / Library / Bible tabs (left), preview and live controls (center), screens (right). */
export function ServicePage({ onOpenScreens }: { onOpenScreens: () => void }) {
  const state = useServiceState()
  const [screens] = useScreensState()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leftTab, setLeftTab] = useState<'order' | 'library' | 'bible'>('order')
  const [library, setLibrary] = useState<LibSelection>({ kind: 'favorites' })
  const [dropOnOrder, setDropOnOrder] = useState(false)
  // The Bible state lives here, so it stays the same when the tab changes.
  const bible = useBible(state?.bibles ?? [])
  const [bibleFocus, setBibleFocus] = useState(0)

  // Ctrl+B: after the Bible tab is shown, put the cursor in its search input.
  useEffect(() => {
    if (bibleFocus) bible.focusSearch()
  }, [bibleFocus])

  const items = state?.service.items ?? []
  const selected = items.find((i) => i.id === selectedId) ?? null

  // Keys: Space next item, Esc clear, ← → slides, ↑ ↓ select, Enter go live.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Ctrl+B: open the Bible tab and search (works from any input too).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setLeftTab('bible')
        setBibleFocus((n) => n + 1)
        return
      }
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      // Ctrl+Z: undo the last change to the order.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void api.undo()
        return
      }
      // The Bible verse list uses ↑ ↓ itself (verse by verse).
      if (target.closest('[data-own-keys]') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return
      // F1–F8: hotkeys, one press = live now.
      const fKey = /^F([1-8])$/.exec(e.key)
      if (fKey) {
        e.preventDefault()
        void api.triggerHotkey(Number(fKey[1]))
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        void api.next()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        void api.clear()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        void api.pageStep(e.key === 'ArrowRight' ? 1 : -1)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const index = items.findIndex((i) => i.id === selectedId)
        const nextIndex = e.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)
        if (items[nextIndex]) setSelectedId(items[nextIndex].id)
      } else if (e.key === 'Enter' && selectedId) {
        e.preventDefault()
        void api.goLive(selectedId)
      } else if (e.key === 'Delete' && selectedId) {
        // Delete removes the selected item (Ctrl+Z brings it back). Not the live item.
        const index = items.findIndex((i) => i.id === selectedId)
        if (index < 0 || items[index].status === 'live') return
        e.preventDefault()
        void api.removeItem(selectedId)
        const nextItem = items[index + 1] ?? items[index - 1]
        if (nextItem) setSelectedId(nextItem.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, selectedId])

  if (!state) return null

  /** "Open in preview": add the file to the order and show it in the preview. */
  const openInPreview = async (path: string) => {
    await api.addFiles([path])
    const s = await api.getService()
    const added = [...s.service.items].reverse().find((i) => i.path === path)
    if (added) setSelectedId(added.id)
    setLeftTab('order')
  }

  return (
    <div className="service">
      <div className="service-top">
        <div className="left-col">
          <nav className="tabs left-tabs">
            <button
              className={['tab', leftTab === 'order' ? 'is-active' : '', dropOnOrder ? 'is-drop' : ''].join(' ')}
              onClick={() => setLeftTab('order')}
              // Drop a file from the library on the Order tab to add it.
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(pathDragType)) return
                e.preventDefault()
                setDropOnOrder(true)
              }}
              onDragLeave={() => setDropOnOrder(false)}
              onDrop={(e) => {
                setDropOnOrder(false)
                const path = e.dataTransfer.getData(pathDragType)
                if (path) void api.addFiles([path])
              }}
            >
              {strings.orderLabel}
            </button>
            <button className={leftTab === 'library' ? 'tab is-active' : 'tab'} onClick={() => setLeftTab('library')}>
              {strings.libraryLabel}
            </button>
            <button
              className={leftTab === 'bible' ? 'tab is-active' : 'tab'}
              title={strings.bibleTabHint}
              onClick={() => setLeftTab('bible')}
            >
              {strings.bibleLabel}
            </button>
          </nav>
          {leftTab === 'order' && <OrderPanel state={state} selectedId={selectedId} onSelect={setSelectedId} />}
          {leftTab === 'library' && <LibrarySide state={state} selection={library} onSelect={setLibrary} />}
          {leftTab === 'bible' && <BibleSide state={state} bible={bible} />}
        </div>
        <div className="service-center">
          {leftTab === 'order' && <PreviewPanel state={state} item={selected} />}
          {leftTab === 'library' && (
            <LibraryMain state={state} selection={library} onOpenInPreview={(p) => void openInPreview(p)} />
          )}
          {leftTab === 'bible' && <BibleMain state={state} bible={bible} />}
          <LivePanel state={state} />
        </div>
        <ScreensColumn state={state} screens={screens} onOpenScreens={onOpenScreens} />
      </div>
      <div className="service-bottom">
        <QuickPanel
          state={state}
          onEditHotkeys={() => {
            setLibrary({ kind: 'favorites' })
            setLeftTab('library')
          }}
        />
      </div>
    </div>
  )
}

// ---- Live ----

function LivePanel({ state }: { state: ServiceState }) {
  // One row of video controls per take (groups that got the same item together share one).
  const takes = new Map<number, { content: ContentLayer; groups: string[] }>()
  for (const g of state.groups) {
    const c = g.live.content
    if (!c) continue
    const entry = takes.get(c.take) ?? { content: c, groups: [] }
    entry.groups.push(g.config.name)
    takes.set(c.take, entry)
  }

  const texts = new Map<number, { title: string; label: string; groups: string[] }>()
  for (const g of state.groups) {
    const t = g.live.text
    if (!t) continue
    const entry = texts.get(t.take) ?? { title: t.title, label: t.screens[t.index]?.label ?? '', groups: [] }
    entry.groups.push(g.config.name)
    texts.set(t.take, entry)
  }

  return (
    <section className={takes.size || texts.size ? 'panel live-panel is-live' : 'panel live-panel'}>
      <div className="live-head">
        <h2 className="label">{strings.liveLabel}</h2>
      </div>
      {takes.size === 0 && texts.size === 0 && <p className="help">{strings.nothingLive}</p>}
      {[...texts.entries()].map(([t, x]) => (
        <div key={t} className="live-take">
          <div className="live-now">
            <span className="tag tag-live">{strings.badgeLive}</span>
            <span className="live-title">{x.title}</span>
            <span className="mono">{x.label}</span>
            <span className="dim">→ {x.groups.join(', ')}</span>
            <button className="btn btn-small btn-icon" title={strings.prevTextScreen} onClick={() => void api.pageStep(-1)}>
              ‹
            </button>
            <button className="btn btn-small btn-icon" title={strings.nextTextScreen} onClick={() => void api.pageStep(1)}>
              ›
            </button>
            <button className="btn btn-small btn-quiet" onClick={() => void api.clearText()}>
              {strings.clearTextShort}
            </button>
          </div>
        </div>
      ))}
      {[...takes.values()].map(({ content, groups }) => (
        <LiveTake key={content.take} state={state} content={content} groups={groups} />
      ))}

      <div className="transport">
        <button className="btn btn-big" onClick={() => void api.previous()}>
          ← {strings.previous}
        </button>
        <button className="btn btn-big btn-next" onClick={() => void api.next()}>
          {strings.next} →
        </button>
        <button className="btn btn-big" onClick={() => void api.clear()}>
          {strings.clear}
        </button>
        <span className="dim keys-help">{strings.keysHelp}</span>
      </div>
    </section>
  )
}

function LiveTake({ state, content, groups }: { state: ServiceState; content: ContentLayer; groups: string[] }) {
  const item = state.service.items.find((i) => i.id === content.itemId)
  const playback = state.playback[content.take]
  const [dragTime, setDragTime] = useState<number | null>(null)
  const time = playback?.currentTime
  const duration = playback?.duration || item?.duration || 0

  const commitSeek = () => {
    if (dragTime !== null) void api.seek(content.take, dragTime)
    setDragTime(null)
  }

  return (
    <div className="live-take">
      <div className="live-now">
        <span className="tag tag-live">{strings.badgeLive}</span>
        {item && <TypeIcon type={item.type} />}
        <span className="live-title">{item?.title}</span>
        <span className="dim">→ {groups.join(', ')}</span>
      </div>
      {content.type === 'video' && (
        <div className="video-controls">
          <button className="btn" onClick={() => void api.setPlaying(content.take, !content.playing)}>
            {content.playing ? strings.pause : strings.play}
          </button>
          <button className="btn" onClick={() => void api.seek(content.take, (time ?? 0) - 10)}>
            {strings.back10}
          </button>
          <button className="btn" onClick={() => void api.seek(content.take, (time ?? 0) + 10)}>
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
          <span className="dim">−{formatTime(Math.max(0, duration - (dragTime ?? time ?? 0)))}</span>
          {item && (
            <label className="live-volume" title={strings.volume}>
              🔊
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={item.settings.volume ?? 1}
                onChange={(e) => void api.updateItem(item.id, { settings: { volume: Number(e.target.value) } })}
              />
              <span className="mono">{Math.round((item.settings.volume ?? 1) * 100)}%</span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
