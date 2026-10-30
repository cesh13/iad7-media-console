import { useEffect, useRef, useState } from 'react'
import type { AudioState, ContentLayer, GroupView, ServiceItem, ServiceState, TextLayer } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { useAudioState } from './AudioTab'
import { useScreensState, useServiceState } from './hooks'
import { BibleMain, BibleSide, useBible } from './BiblePanel'
import { LibraryMain, LibrarySide, pathDragType, type LibSelection } from './LibraryView'
import { iconFor, OrderPanel, TypeIcon, type IconKind } from './OrderPanel'
import { PreviewPanel } from './PreviewPanel'
import { MediaButton, MediaIcon } from './MediaIcons'
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
  const blackOn = !!state?.overlays.black
  const textLive = !!state?.groups.some((g) => g.live.text)

  // Esc must be pressed twice to clear everything. One stray Esc (for example
  // from the slideshow button of a presenter clicker) must not blank the screens.
  const escAt = useRef(0)
  const [escArmed, setEscArmed] = useState(false)
  useEffect(() => {
    if (!escArmed) return
    const timer = setTimeout(() => setEscArmed(false), escWindowMs)
    return () => clearTimeout(timer)
  }, [escArmed])

  // Keys: Space next item, Esc Esc clear, ← → and Page Up/Down slides, B or . black,
  // ↑ ↓ select, Enter go live. Page Up/Down, B and . are what presenter clickers send.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Shift+F5 comes from the slideshow button of some clickers: do nothing.
      // F5 alone stays a hotkey (F1–F8).
      if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault()
        return
      }
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
        const now = Date.now()
        if (now - escAt.current < escWindowMs) {
          escAt.current = 0
          setEscArmed(false)
          clearAll()
        } else {
          escAt.current = now
          setEscArmed(true)
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault()
        void api.pageStep(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1)
      } else if (e.key === 'b' || e.key === 'B' || e.key === '.') {
        e.preventDefault()
        void api.setOverlay('black', !blackOn)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        // In the Bible tab with text live, ↓ ↑ go to the next or previous verse, like → ←.
        if (leftTab === 'bible' && textLive) return void api.pageStep(e.key === 'ArrowDown' ? 1 : -1)
        const index = items.findIndex((i) => i.id === selectedId)
        const nextIndex = e.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)
        if (items[nextIndex]) setSelectedId(items[nextIndex].id)
      } else if (e.key === 'Enter' && leftTab === 'bible' && (target.tagName !== 'BUTTON' || target.closest('.verse-list'))) {
        // Bible tab: Enter = "Show now" for the chosen verses (not a click on the focused verse).
        e.preventDefault()
        if (!bible.ref) return
        void api.showBibleNow(bible.ref)
        bible.listRef.current?.focus()
      } else if (leftTab !== 'order') {
        // Enter and Delete below act on the order, so only in the Order tab.
        return
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
  }, [items, selectedId, blackOn, leftTab, textLive, bible.ref])

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
        <div className="service-center-col">
          <div className="service-center">
            {leftTab === 'order' && <PreviewPanel state={state} item={selected} />}
            {leftTab === 'library' && (
              <LibraryMain state={state} selection={library} onOpenInPreview={(p) => void openInPreview(p)} />
            )}
            {leftTab === 'bible' && <BibleMain state={state} bible={bible} />}
          </div>
          {/* Always visible under the scrolling area, so the live controls never need a scroll. */}
          <LivePanel state={state} escArmed={escArmed} />
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

/** Time for the second Esc press (ms). */
const escWindowMs = 1500

/** Take everything off: the screens (in the target groups) and the audio item. */
function clearAll(): void {
  void api.clear()
  void api.stopItemAudio()
}

/**
 * Everything that is live now, one row per layer, each with its own controls
 * and its own stop button. The order of the rows is fixed: picture or video,
 * then text, then the audio item, so a row does not move while you use it.
 */
function LivePanel({ state, escArmed }: { state: ServiceState; escArmed: boolean }) {
  const audio = useAudioState()

  // Groups that got the same item together share one row.
  const takes = new Map<number, { content: ContentLayer; groups: GroupView[] }>()
  const texts = new Map<number, { text: TextLayer; groups: GroupView[] }>()
  for (const g of state.groups) {
    const c = g.live.content
    if (c) {
      const entry = takes.get(c.take) ?? { content: c, groups: [] }
      entry.groups.push(g)
      takes.set(c.take, entry)
    }
    const t = g.live.text
    if (t) {
      const entry = texts.get(t.take) ?? { text: t, groups: [] }
      entry.groups.push(g)
      texts.set(t.take, entry)
    }
  }
  const rowCount = takes.size + texts.size + (audio?.item ? 1 : 0)
  const isLive = rowCount > 0

  return (
    <section className={isLive ? 'live-bar is-live' : 'live-bar'}>
      <div className="live-takes">
        {escArmed && isLive && <div className="live-now live-esc warn">{strings.escAgain}</div>}
        {!isLive && (
          <div className="live-now">
            <span className="label">{strings.liveLabel}</span>
            <span className="dim">{strings.nothingLive}</span>
          </div>
        )}
        {[...takes.values()].map(({ content, groups }) => (
          <LiveContentRow key={content.take} state={state} content={content} groups={groups} />
        ))}
        {[...texts.values()].map(({ text, groups }) => (
          <div key={text.take} className="live-now">
            <span className="tag tag-live">{strings.badgeLive}</span>
            <TypeIcon type={textIcon(state, text.itemId)} />
            <span className="live-title" title={groupNames(groups)}>
              {text.title}
            </span>
            <span className="mono">{text.screens[text.index]?.label}</span>
            <span className="live-spacer" />
            <button className="btn btn-small btn-icon" title={strings.prevTextScreen} onClick={() => void api.pageStep(-1)}>
              ‹
            </button>
            <button className="btn btn-small btn-icon" title={strings.nextTextScreen} onClick={() => void api.pageStep(1)}>
              ›
            </button>
            <StopButton title={strings.stopTextHint} onClick={() => groups.forEach((g) => void api.clearText(g.config.id))} />
          </div>
        ))}
        {audio?.item && <LiveAudioRow state={state} item={audio.item} />}
      </div>
      {/* With one row, its own ✕ does the same, so "Clear all" shows only for two or more rows. Esc always clears all. */}
      {rowCount > 1 && (
        <div className="live-transport">
          <button className="btn" title={strings.clearHint} onClick={clearAll}>
            {strings.clearAll}
          </button>
        </div>
      )}
    </section>
  )
}

function groupNames(groups: GroupView[]): string {
  return '→ ' + groups.map((g) => g.config.name).join(', ')
}

/** Bible text from the Bible tab has no item in the order. */
function textIcon(state: ServiceState, itemId: string | null): IconKind {
  const item = itemId ? findOrderItem(state, itemId) : undefined
  return item ? iconFor(item) : 'bible'
}

/** An item of the order, or the chosen file of a folder item. */
function findOrderItem(state: ServiceState, itemId: string): ServiceItem | undefined {
  return state.service.items.flatMap((i) => (i.child ? [i, i.child] : [i])).find((i) => i.id === itemId)
}

function StopButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button className="btn btn-small btn-quiet live-stop" title={title} aria-label={title} onClick={onClick}>
      ✕
    </button>
  )
}

/** A seek bar that moves while dragged and seeks once, when let go. */
function SeekBar(props: { time: number | undefined; duration: number; onSeek: (t: number) => void }) {
  const { time, duration, onSeek } = props
  const [dragTime, setDragTime] = useState<number | null>(null)
  const shown = dragTime ?? time ?? 0
  const commit = () => {
    if (dragTime !== null) onSeek(dragTime)
    setDragTime(null)
  }
  return (
    <>
      <span className="mono">{formatTime(shown)}</span>
      <input
        className="timebar"
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={shown}
        onChange={(e) => setDragTime(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
      />
      <span className="mono dim" title={formatTime(duration || undefined)}>
        −{formatTime(Math.max(0, duration - shown))}
      </span>
    </>
  )
}

function VolumeControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="live-volume" title={strings.volume}>
      <MediaIcon name="volume" />
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="mono">{Math.round(value * 100)}%</span>
    </label>
  )
}

/** Picture, video, slides or countdown on one or more groups. */
function LiveContentRow({ state, content, groups }: { state: ServiceState; content: ContentLayer; groups: GroupView[] }) {
  const item = findOrderItem(state, content.itemId)
  const playback = state.playback[content.take]
  const duration = playback?.duration || item?.duration || 0

  return (
    <div className="live-now">
      <span className="tag tag-live">{strings.badgeLive}</span>
      {item && <TypeIcon type={iconFor(item)} />}
      <span className="live-title" title={groupNames(groups)}>
        {item?.title}
      </span>
      {content.type === 'video' ? (
        <div className="video-controls live-video">
          <MediaButton
            icon={content.playing ? 'pause' : 'play'}
            label={content.playing ? strings.pause : strings.play}
            onClick={() => void api.setPlaying(content.take, !content.playing)}
          />
          <MediaButton icon="back10" label={strings.back10} quiet onClick={() => void api.seek(content.take, (playback?.currentTime ?? 0) - 10)} />
          <MediaButton icon="forward10" label={strings.forward10} quiet onClick={() => void api.seek(content.take, (playback?.currentTime ?? 0) + 10)} />
          <SeekBar time={playback?.currentTime} duration={duration} onSeek={(t) => void api.seek(content.take, t)} />
          {item && (
            <VolumeControl
              value={item.settings.volume ?? 1}
              onChange={(v) => void api.updateItem(item.id, { settings: { volume: v } })}
            />
          )}
        </div>
      ) : (
        <>
          <span className="dim live-groups">{groupNames(groups)}</span>
          <span className="live-spacer" />
        </>
      )}
      <StopButton title={strings.stopContentHint} onClick={() => groups.forEach((g) => void api.clear(g.config.id))} />
    </div>
  )
}

/** The audio item from the order (one for all groups). */
function LiveAudioRow({ state, item }: { state: ServiceState; item: NonNullable<AudioState['item']> }) {
  const orderItem = findOrderItem(state, item.itemId)
  return (
    <div className="live-now">
      <span className="tag tag-live">{strings.badgeLive}</span>
      <TypeIcon type="audio" />
      <span className="live-title">{item.title}</span>
      <div className="video-controls live-video">
        <MediaButton
          icon={item.playing ? 'pause' : 'play'}
          label={item.playing ? strings.pause : strings.play}
          onClick={() => void api.controlItemAudio({ playing: !item.playing })}
        />
        <MediaButton icon="back10" label={strings.back10} quiet onClick={() => void api.controlItemAudio({ seekTo: item.time - 10 })} />
        <MediaButton icon="forward10" label={strings.forward10} quiet onClick={() => void api.controlItemAudio({ seekTo: item.time + 10 })} />
        <SeekBar time={item.time} duration={item.duration} onSeek={(t) => void api.controlItemAudio({ seekTo: t })} />
        <VolumeControl
          value={item.volume}
          onChange={(v) => {
            void api.controlItemAudio({ volume: v })
            // Keep it for the next time this item plays.
            if (orderItem) void api.updateItem(orderItem.id, { settings: { volume: v } })
          }}
        />
      </div>
      <StopButton title={strings.stopAudioHint} onClick={() => void api.stopItemAudio()} />
    </div>
  )
}
