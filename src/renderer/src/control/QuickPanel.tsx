import { useState } from 'react'
import type { ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { AudioTab, MusicStrip } from './AudioTab'
import { HotkeysBar } from './ServiceBar'
import { MessageTab, StageTab, messageIsLive } from './StageTab'

type Tab = 'audio' | 'message' | 'stage'

/**
 * Bottom strip (SPEC 5.6): one slim bar with hotkeys, a music summary and the
 * Audio / Message / Stage buttons. A button opens its drawer above the bar;
 * a second click closes it. The drawer pushes the content up, it never covers it.
 */
export function QuickPanel({ state, onEditHotkeys }: { state: ServiceState; onEditHotkeys: () => void }) {
  const [open, setOpen] = useState<Tab | null>(null)
  // A dot on a button while something from that tab is on a screen.
  const tabs: [Tab, string, boolean][] = [
    ['audio', strings.tabAudio, false],
    ['message', strings.tabMessage, messageIsLive(state)],
    ['stage', strings.tabStage, !!state.stageMessage || state.stageTimer.running]
  ]
  return (
    <section className="quick">
      {open && (
        <div className="quick-drawer">
          {open === 'audio' && <AudioTab />}
          {open === 'message' && <MessageTab state={state} />}
          {open === 'stage' && <StageTab state={state} />}
        </div>
      )}
      <div className="quick-bar">
        <HotkeysBar state={state} onEdit={onEditHotkeys} />
        <MusicStrip />
        <nav className="quick-tabs">
          {tabs.map(([id, label, live]) => (
            <button
              key={id}
              className={open === id ? 'quick-tab is-open' : 'quick-tab'}
              title={live ? strings.tabOnScreen : undefined}
              onClick={() => setOpen(open === id ? null : id)}
            >
              {live && <span className="live-dot" />}
              {label}
              <span className="quick-caret">{open === id ? '▼' : '▲'}</span>
            </button>
          ))}
        </nav>
      </div>
    </section>
  )
}
