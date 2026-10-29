import { useEffect, useState } from 'react'
import type { ContentLayer, ServiceState } from '../../../shared/types'
import { formatTime, strings } from '../strings'
import { useScreensState, useServiceState } from './hooks'
import { BiblePanel } from './BiblePanel'
import { OrderPanel, TypeIcon } from './OrderPanel'
import { PreviewPanel } from './PreviewPanel'
import { QuickPanel } from './QuickPanel'
import { ScreensColumn } from './ScreensColumn'

const api = window.mediaConsole

/** Service order (left), preview and live controls (center), screens (right). */
export function ServicePage() {
  const state = useServiceState()
  const [screens] = useScreensState()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const items = state?.service.items ?? []
  const selected = items.find((i) => i.id === selectedId) ?? null

  // Keys: Space next item, Esc clear, ← → slides, ↑ ↓ select, Enter go live.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      // The Bible verse list uses ↑ ↓ itself (verse by verse).
      if (target.closest('[data-own-keys]') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, selectedId])

  if (!state) return null

  return (
    <div className="service">
      <div className="service-top">
        <OrderPanel state={state} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="service-center">
          <PreviewPanel state={state} item={selected} />
          <LivePanel state={state} />
        </div>
        <ScreensColumn state={state} screens={screens} />
      </div>
      <div className="service-bottom">
        <BiblePanel state={state} />
        <QuickPanel state={state} />
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
        </div>
      )}
    </div>
  )
}
