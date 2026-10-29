import { useState } from 'react'
import { strings } from '../strings'
import { useServiceState } from './hooks'
import { ScreensPage } from './ScreensPage'
import { ServicePage } from './ServicePage'

const api = window.mediaConsole

type Tab = 'service' | 'screens'

export function App() {
  const [tab, setTab] = useState<Tab>('service')
  const state = useServiceState()
  const overlays = state?.overlays

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
        {overlays && (
          <div className="topbar-actions">
            <button
              className={overlays.logo ? 'btn btn-on' : 'btn'}
              disabled={!state.logoUrl}
              title={state.logoUrl ? undefined : strings.noLogoHint}
              onClick={() => void api.setOverlay('logo', !overlays.logo)}
            >
              {strings.logo}
            </button>
            <button
              className={overlays.black ? 'btn btn-black is-on' : 'btn btn-black'}
              onClick={() => void api.setOverlay('black', !overlays.black)}
            >
              {overlays.black ? strings.blackOn : strings.blackAll}
            </button>
          </div>
        )}
      </header>
      {tab === 'service' ? <ServicePage /> : <ScreensPage />}
    </div>
  )
}
