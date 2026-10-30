import { useEffect, useState } from 'react'
import type { RemoteStatus } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

/** Screens page: turn the remote control on or off, set the PIN, and show the address to open (SPEC section 11). */
export function RemoteSection() {
  const [status, setStatus] = useState<RemoteStatus | null>(null)
  useEffect(() => {
    void api.getRemote().then(setStatus)
    return api.onRemoteChanged(setStatus)
  }, [])

  const savedPin = status?.pin ?? ''
  const [pin, setPin] = useState(savedPin)
  useEffect(() => setPin(savedPin), [savedPin])
  const savedPort = String(status?.port ?? '')
  const [port, setPort] = useState(savedPort)
  useEffect(() => setPort(savedPort), [savedPort])

  if (!status) return null

  // A PIN that is too short, or a bad port, goes back to the saved value.
  const savePin = () => {
    if (/^\d{4,8}$/.test(pin) && pin !== savedPin) void api.updateRemote({ pin }).then(setStatus)
    else setPin(savedPin)
  }
  const savePort = () => {
    const n = Number(port)
    if (Number.isInteger(n) && n >= 1024 && n <= 65535 && port !== savedPort) void api.updateRemote({ port: n }).then(setStatus)
    else setPort(savedPort)
  }

  return (
    <section className="panel">
      <h2 className="label">{strings.remoteLabel}</h2>
      <p className="help">{strings.remoteHelp}</p>
      <div className="remote-row">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={status.enabled}
            onChange={(e) => void api.updateRemote({ enabled: e.target.checked }).then(setStatus)}
          />
          <span className="switch-track" />
          {strings.remoteOn}
        </label>
        <label className="remote-field" title={strings.remotePinHelp}>
          {strings.remotePin}
          <input
            className="input mono remote-pin"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onBlur={savePin}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
        <label className="remote-field">
          {strings.remotePort}
          <input
            className="input mono remote-port"
            inputMode="numeric"
            maxLength={5}
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
            onBlur={savePort}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      </div>
      {status.enabled && status.error && (
        <p className="warn small">
          {status.error === 'EADDRINUSE' ? strings.remotePortInUse(status.port) : strings.remoteError(status.error)}
        </p>
      )}
      {status.enabled && !status.error && (
        <div className="remote-info">
          <div className="dim small">{strings.remoteAddresses}</div>
          {status.addresses.length ? (
            status.addresses.map((a) => (
              <div key={a} className="mono remote-address">
                {a}
              </div>
            ))
          ) : (
            <div className="warn small">{strings.remoteNoAddress}</div>
          )}
          <div className="small">
            <span className={status.clients ? 'dot dot-ok' : 'dot dot-none'} /> {strings.remoteClients(status.clients)}
          </div>
          <p className="dim small">{strings.remoteFirewall}</p>
        </div>
      )}
    </section>
  )
}
