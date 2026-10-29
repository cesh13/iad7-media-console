import { useState } from 'react'
import { strings } from '../strings'
import { useScreensState, useServiceState } from './hooks'
import { hasConnectedOutput } from './ScreensColumn'
import { ServiceClock } from './ServiceBar'
import { ScreensPage } from './ScreensPage'
import { ServicePage } from './ServicePage'

const api = window.mediaConsole

type Tab = 'service' | 'screens'

export function App() {
  const [tab, setTab] = useState<Tab>('service')
  const state = useServiceState()
  const [screens] = useScreensState()
  const overlays = state?.overlays

  return (
    <div className="app">
      <header className="topbar">
        <nav className="tabs">
          <button className={tab === 'service' ? 'tab is-active' : 'tab'} onClick={() => setTab('service')}>
            {strings.tabService}
          </button>
          <button className={tab === 'screens' ? 'tab is-active' : 'tab'} onClick={() => setTab('screens')}>
            {strings.tabScreens}
          </button>
        </nav>
        <span className="app-name">{strings.appName}</span>
        <div className="topbar-actions">
          {state && <ServiceClock state={state} />}
          {screens && !hasConnectedOutput(screens) && (
            <button className="no-outputs-chip" onClick={() => setTab('screens')}>
              <span className="dot dot-warn" />
              {strings.noScreensChip}
            </button>
          )}
          {overlays && (
            <>
              <button
                className={overlays.logo ? 'btn btn-on' : 'btn'}
                disabled={!state.logoUrl}
                title={state.logoUrl ? undefined : strings.noLogoHint}
                onClick={() => void api.setOverlay('logo', !overlays.logo)}
              >
                {strings.logo}
              </button>
              <button
                className="btn"
                disabled={!state.groups.some((g) => g.live.text)}
                onClick={() => void api.clearText('all')}
              >
                {strings.clearText}
              </button>
              <button
                className={overlays.black ? 'btn btn-black is-on' : 'btn btn-black'}
                onClick={() => void api.setOverlay('black', !overlays.black)}
              >
                {overlays.black ? strings.blackOn : strings.blackAll}
              </button>
            </>
          )}
        </div>
      </header>
      {tab === 'service' ? <ServicePage onOpenScreens={() => setTab('screens')} /> : <ScreensPage />}
    </div>
  )
}
