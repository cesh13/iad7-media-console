import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemoteCommand, RemoteGroup, RemoteState } from '../../../shared/types'
import { formatTime, strings } from '../strings'

// The remote control page (SPEC section 11). It runs in the browser of a phone
// or another computer, gets the state from the app over Server-Sent Events,
// and sends commands with POST.

type Phase = 'checking' | 'login' | 'ready' | 'offline'

function useRemote() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [state, setState] = useState<RemoteState | null>(null)
  const [connected, setConnected] = useState(false)
  const source = useRef<EventSource | null>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)

  const check = useCallback(async () => {
    if (retry.current) clearTimeout(retry.current)
    try {
      const r = await fetch('/api/session')
      if (r.status === 401) return setPhase('login')
      if (!r.ok) throw new Error(String(r.status))
      setPhase('ready')
    } catch {
      setPhase((p) => (p === 'ready' ? p : 'offline'))
      setConnected(false)
      retry.current = setTimeout(() => void check(), 3000)
    }
  }, [])

  useEffect(() => {
    void check()
    return () => {
      if (retry.current) clearTimeout(retry.current)
    }
  }, [check])

  // While signed in: keep one event stream open. EventSource reconnects by itself
  // after a network drop; when the app refuses it (signed out), check again.
  useEffect(() => {
    if (phase !== 'ready') return
    const es = new EventSource('/api/events')
    source.current = es
    es.onopen = () => setConnected(true)
    es.onmessage = (e) => {
      setConnected(true)
      setState(JSON.parse(e.data) as RemoteState)
    }
    es.addEventListener('signout', () => {
      es.close()
      setPhase('login')
    })
    es.onerror = () => {
      setConnected(false)
      if (es.readyState === EventSource.CLOSED) {
        es.close()
        retry.current = setTimeout(() => void check(), 2000)
      }
    }
    return () => es.close()
  }, [phase, check])

  const send = useCallback(
    async (cmd: RemoteCommand) => {
      try {
        const r = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd)
        })
        if (r.status === 401) setPhase('login')
      } catch {
        setConnected(false)
      }
    },
    []
  )

  return { phase, state, connected, send, signedIn: () => setPhase('ready') }
}

export function Remote() {
  const { phase, state, connected, send, signedIn } = useRemote()
  if (phase === 'checking') return null
  if (phase === 'login') return <Login onDone={signedIn} />
  if (phase === 'offline' || !state) {
    return (
      <div className="r-center">
        <p className="r-dim">{phase === 'offline' ? strings.rNoConnection : strings.rReconnecting}</p>
      </div>
    )
  }
  return <Main state={state} connected={connected} send={send} />
}

function Login(props: { onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })
      if (r.ok) return props.onDone()
      if (r.status === 429) {
        const { waitSeconds } = (await r.json()) as { waitSeconds: number }
        setMessage(strings.rWait(waitSeconds))
      } else setMessage(strings.rWrongPin)
      setPin('')
    } catch {
      setMessage(strings.rNoConnection)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="r-center r-login"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h1 className="r-title">{strings.rTitle}</h1>
      <p className="r-dim">{strings.rPinPrompt}</p>
      <input
        className="r-pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        maxLength={8}
        autoFocus
        value={pin}
        aria-label={strings.remotePin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
      {message && <p className="r-warn">{message}</p>}
      <button className="r-btn r-btn-primary" disabled={busy || pin.length < 4}>
        {strings.rSignIn}
      </button>
    </form>
  )
}

type Send = (cmd: RemoteCommand) => Promise<void>

function Main(props: { state: RemoteState; connected: boolean; send: Send }) {
  const { state, connected, send } = props
  const [selected, setSelected] = useState<string | null>(null)
  const nextItem = state.items.find((i) => i.id === state.nextItemId)
  const targetGroups = state.groups.filter((g) => state.target === 'all' || g.id === state.target)
  // Page buttons step the slides or the text that is live in the target (like ← → in the app).
  const canStep = targetGroups.some((g) => g.text || g.content?.type === 'slides')

  return (
    <div className="r-app">
      <header className="r-top">
        <span className="r-service">{state.serviceName}</span>
        <span className={connected ? 'r-status is-ok' : 'r-status'}>
          <span className="r-dot" />
          {connected ? strings.rConnected : strings.rReconnecting}
        </span>
      </header>

      <div className="r-row">
        <button
          className={state.overlays.black ? 'r-btn r-btn-black is-on' : 'r-btn r-btn-black'}
          onClick={() => void send({ name: 'overlay', overlay: 'black', on: !state.overlays.black })}
        >
          {state.overlays.black ? strings.rBlackOn : strings.rBlack}
        </button>
        <button
          className={state.overlays.logo ? 'r-btn is-on' : 'r-btn'}
          disabled={!state.hasLogo}
          onClick={() => void send({ name: 'overlay', overlay: 'logo', on: !state.overlays.logo })}
        >
          {strings.rLogo}
        </button>
        <button className="r-btn" disabled={!state.groups.some((g) => g.text)} onClick={() => void send({ name: 'clearText' })}>
          {strings.rClearText}
        </button>
      </div>

      {state.groups.map((g) => (
        <GroupCard key={g.id} group={g} state={state} send={send} />
      ))}

      <section className="r-transport">
        {state.groups.length > 1 && (
          <label className="r-target">
            <span className="r-dim">{strings.rTarget}</span>
            <select
              className="r-select"
              value={state.target}
              onChange={(e) => void send({ name: 'setTarget', target: e.target.value })}
            >
              <option value="all">{strings.rTargetAll}</option>
              {state.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {canStep && (
          <div className="r-row">
            <button className="r-btn r-btn-big" onClick={() => void send({ name: 'pageStep', delta: -1 })}>
              ‹ {strings.rPrevPage}
            </button>
            <button className="r-btn r-btn-big" onClick={() => void send({ name: 'pageStep', delta: 1 })}>
              {strings.rNextPage} ›
            </button>
          </div>
        )}
        <div className="r-row">
          <button className="r-btn r-btn-big" onClick={() => void send({ name: 'previous' })}>
            ◀ {strings.rPrevious}
          </button>
          <button className="r-btn r-btn-big r-btn-next" onClick={() => void send({ name: 'next' })}>
            {strings.rNext} ▶
          </button>
        </div>
        <p className="r-dim r-next-title">{nextItem ? strings.rNextItem(nextItem.title) : strings.rEndOfOrder}</p>
      </section>

      <section className="r-section">
        <h2 className="r-label">{strings.rOrder}</h2>
        {state.items.length === 0 && <p className="r-dim">{strings.rEmptyOrder}</p>}
        <ul className="r-order">
          {state.items.map((item) => {
            const isNext = item.id === state.nextItemId
            const isSelected = item.id === selected
            return (
              <li
                key={item.id}
                className={['r-item', `is-${item.status}`, isNext ? 'is-next' : '', isSelected ? 'is-selected' : ''].join(' ')}
              >
                <button className="r-item-main" onClick={() => setSelected(isSelected ? null : item.id)}>
                  <span className="r-item-mark">
                    {item.status === 'live' ? strings.badgeLive : isNext ? strings.badgeNext : item.status === 'done' ? '✓' : ''}
                  </span>
                  <span className="r-item-title">{item.title}</span>
                  <span className="r-item-type">{item.ready ? strings.types[item.type] : strings.rNotReady}</span>
                </button>
                {isSelected && (
                  <button
                    className="r-btn r-btn-live"
                    disabled={!item.ready}
                    onClick={() => {
                      void send({ name: 'goLive', itemId: item.id })
                      setSelected(null)
                    }}
                  >
                    {strings.rGoLive}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="r-section r-music">
        <h2 className="r-label">{strings.rMusic}</h2>
        {state.audioItem && (
          <div className="r-row r-music-row">
            <span className="r-music-title">{strings.rAudioItem(state.audioItem.title)}</span>
            <button
              className="r-btn"
              onClick={() => void send({ name: 'audioItemPlaying', playing: !state.audioItem!.playing })}
            >
              {state.audioItem.playing ? strings.rPause : strings.rPlay}
            </button>
          </div>
        )}
        {state.music.hasPlaylist ? (
          <>
            <div className="r-music-title">{state.music.title}</div>
            <div className="r-row">
              <button className="r-btn" onClick={() => void send({ name: state.music.playing ? 'musicPause' : 'musicPlay' })}>
                {state.music.playing ? strings.rPause : strings.rPlay}
              </button>
              <button className="r-btn" onClick={() => void send({ name: 'musicNext' })}>
                {strings.rMusicNext}
              </button>
              <button className="r-btn" disabled={!state.music.playing} onClick={() => void send({ name: 'musicFadeOut' })}>
                {strings.rFadeOut}
              </button>
            </div>
          </>
        ) : (
          <p className="r-dim">{strings.rNoMusic}</p>
        )}
      </section>
    </div>
  )
}

function GroupCard(props: { group: RemoteGroup; state: RemoteState; send: Send }) {
  const { group: g, state, send } = props
  const c = g.content
  const p = c ? state.playback[c.take] : undefined
  const isVideo = c?.type === 'video'
  const playing = p ? p.playing : !!c?.playing

  return (
    <section className={c || g.text ? 'r-group is-live' : 'r-group'}>
      <div className="r-group-head">
        <span className="r-group-name">{g.name}</span>
        <button className="r-btn r-btn-small" disabled={!c} onClick={() => void send({ name: 'clear', groupId: g.id })}>
          {strings.rClear}
        </button>
      </div>
      {c ? (
        <>
          <div className="r-group-title">
            <span className="r-live-mark">{strings.badgeLive}</span> {c.title}
            {c.pageCount !== undefined && <span className="r-dim"> · {strings.rPage((c.page ?? 0) + 1, c.pageCount)}</span>}
          </div>
          {c.pictureUrl && <img className="r-picture" src={c.pictureUrl} alt="" />}
        </>
      ) : (
        !g.text && <div className="r-dim">{strings.rIdle}</div>
      )}
      {g.text && (
        <div className="r-group-text">
          {g.text.title} <span className="r-dim">· {strings.rPage(g.text.index + 1, g.text.count)}</span>
        </div>
      )}
      {isVideo && (
        <div className="r-video">
          <div className="r-progress">
            <div className="r-progress-bar" style={{ width: p?.duration ? `${(p.time / p.duration) * 100}%` : '0%' }} />
          </div>
          <div className="r-row">
            <span className="r-time mono">
              {formatTime(p?.time)} / {formatTime(p?.duration)}
            </span>
            <button className="r-btn" onClick={() => void send({ name: 'seekBy', take: c.take, seconds: -10 })}>
              {strings.rBack10}
            </button>
            <button className="r-btn" onClick={() => void send({ name: 'setPlaying', take: c.take, playing: !playing })}>
              {playing ? strings.rPause : strings.rPlay}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
