import { useState } from 'react'
import { strings } from '../strings'
import { AudioTab } from './AudioTab'

type Tab = 'audio' | 'message' | 'stage'

/** Bottom right: Audio / Message / Stage tabs (SPEC 5.6). */
export function QuickPanel() {
  const [tab, setTab] = useState<Tab>('audio')
  const tabs: [Tab, string][] = [
    ['audio', strings.tabAudio],
    ['message', strings.tabMessage],
    ['stage', strings.tabStage]
  ]
  return (
    <section className="quick panel-col">
      <nav className="tabs quick-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'tab is-active' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="quick-body">
        {tab === 'audio' && <AudioTab />}
        {tab !== 'audio' && <p className="help">{strings.comingSoon}</p>}
      </div>
    </section>
  )
}
