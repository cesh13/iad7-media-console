import { useState } from 'react'
import { strings } from '../strings'
import { ScreensPage } from './ScreensPage'
import { ServicePage } from './ServicePage'

type Tab = 'service' | 'screens'

export function App() {
  const [tab, setTab] = useState<Tab>('service')

  return (
    <div className="app">
      <header className="topbar">
        <span className="app-name">{strings.appName}</span>
        <nav className="tabs">
          <button className={tab === 'service' ? 'tab is-active' : 'tab'} onClick={() => setTab('service')}>
            {strings.tabService}
          </button>
          <button className={tab === 'screens' ? 'tab is-active' : 'tab'} onClick={() => setTab('screens')}>
            {strings.tabScreens}
          </button>
        </nav>
      </header>
      {tab === 'service' ? <ServicePage /> : <ScreensPage />}
    </div>
  )
}
