import { useState } from 'react'
import type { ServiceState } from '../../../shared/types'
import { strings } from '../strings'
import { AudioTab } from './AudioTab'
import { HotkeysBar } from './ServiceBar'
import { MessageTab, StageTab } from './StageTab'

type Tab = 'audio' | 'message' | 'stage'

/** Bottom strip: hotkeys and Audio / Message / Stage tabs (SPEC 5.6). */
export function QuickPanel({ state }: { state: ServiceState }) {
  const [tab, setTab] = useState<Tab>('audio')
  const tabs: [Tab, string][] = [
    ['audio', strings.tabAudio],
    ['message', strings.tabMessage],
    ['stage', strings.tabStage]
  ]
  return (
    <section className="quick panel-col">
      <HotkeysBar state={state} />
      <nav className="tabs quick-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'tab is-active' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="quick-body">
        {tab === 'audio' && <AudioTab />}
        {tab === 'message' && <MessageTab state={state} />}
        {tab === 'stage' && <StageTab state={state} />}
      </div>
    </section>
  )
}
