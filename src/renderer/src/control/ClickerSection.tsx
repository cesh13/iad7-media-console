import { useEffect, useState } from 'react'
import type { ClickerStatus } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

/** Setup page: pair a presenter clicker so it works while another program is in front (SPEC 5.8). */
export function ClickerSection() {
  const [status, setStatus] = useState<ClickerStatus | null>(null)
  useEffect(() => {
    void api.getClicker().then(setStatus)
    return api.onClickerChanged(setStatus)
  }, [])

  if (!status) return null

  const last = status.lastPress
  return (
    <section className="panel">
      <h2 className="label">{strings.clickerLabel}</h2>
      <p className="help">{strings.clickerHelp}</p>

      {!status.supported ? (
        <p className="warn">{status.error ? strings.clickerError(status.error) : strings.clickerWindowsOnly}</p>
      ) : status.pairing ? (
        <div className="clicker-row">
          <span className="clicker-pairing">{strings.clickerPressNow}</span>
          <button className="btn" onClick={() => void api.cancelClickerPairing()}>
            {strings.clickerCancel}
          </button>
        </div>
      ) : status.paired ? (
        <>
          <div className="clicker-row">
            <span className="clicker-name">{status.paired.name}</span>
            <label className="switch">
              <input
                type="checkbox"
                role="switch"
                checked={status.paired.enabled}
                onChange={(e) => void api.setClickerEnabled(e.target.checked)}
              />
              <span className="switch-track" />
              {strings.clickerBackground}
            </label>
            <div className="spacer" />
            <button className="btn" onClick={() => void api.pairClicker()}>
              {strings.clickerPairAgain}
            </button>
            <button className="btn btn-quiet" onClick={() => void api.forgetClicker()}>
              {strings.clickerForget}
            </button>
          </div>
          <p className="clicker-last">
            <span className="label-inline">{strings.clickerLastPress}</span>{' '}
            {last ? (
              <span key={last.at} className="clicker-press">
                {strings.clickerActions[last.action]} · {new Date(last.at).toLocaleTimeString()}
              </span>
            ) : (
              <span className="dim">{strings.clickerNoPress}</span>
            )}
          </p>
          <p className="help small">{strings.clickerTestHelp}</p>
        </>
      ) : (
        <div className="clicker-row">
          <button className="btn btn-primary" onClick={() => void api.pairClicker()}>
            {strings.clickerPair}
          </button>
        </div>
      )}
    </section>
  )
}
