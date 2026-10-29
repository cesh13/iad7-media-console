import { useEffect, useState } from 'react'
import type { AudioState } from '../../../shared/types'
import { formatTime, strings } from '../strings'

const api = window.mediaConsole

/** The audio output devices of this computer (setSinkId ids and names). */
export function useAudioDevices(): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    const load = () =>
      void navigator.mediaDevices
        .enumerateDevices()
        .then((list) => setDevices(list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'communications')))
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [])
  return devices
}

export function useAudioState(): AudioState | null {
  const [state, setState] = useState<AudioState | null>(null)
  useEffect(() => {
    void api.getAudio().then(setState)
    return api.onAudioChanged(setState)
  }, [])
  return state
}

/** Background music, volumes, level meter, output device (SPEC 5.6). */
export function AudioTab() {
  const state = useAudioState()
  const devices = useAudioDevices()
  const [showList, setShowList] = useState(false)
  if (!state) return null
  const a = state.settings
  const track = a.playlist[state.index]
  const name = track ? track.path.split(/[\\/]/).pop() : strings.noMusic

  return (
    <div className="audio-tab">
      <div className="now-playing">
        <div className="np-title">
          <span className="np-name">{name}</span>
          {state.playing && <span className="tag tag-ok">{strings.playingBadge}</span>}
          {state.ducked && state.playing && <span className="badge">{strings.duckedBadge}</span>}
        </div>
        <span className="dim small">
          {a.playlist.length
            ? strings.playlistLine(state.index + 1, a.playlist.length, a.shuffle)
            : strings.playlistEmpty}
        </span>
        <div className="np-time">
          <span className="mono small">{formatTime(state.position?.time)}</span>
          <div className="progress-bar">
            <div
              className="progress-fill progress-music"
              style={{ width: `${state.position?.duration ? (state.position.time / state.position.duration) * 100 : 0}%` }}
            />
          </div>
          <span className="mono small dim">{formatTime(state.position?.duration || undefined)}</span>
        </div>
        <div className="button-row tight">
          <button className="btn btn-small" disabled={!a.playlist.length} onClick={() => void api.musicPrevious()}>
            ⏮
          </button>
          <button
            className="btn btn-small"
            disabled={!a.playlist.length}
            onClick={() => void (state.playing ? api.musicPause() : api.musicPlay())}
          >
            {state.playing ? strings.pause : strings.play}
          </button>
          <button className="btn btn-small" disabled={!a.playlist.length} onClick={() => void api.musicNext()}>
            ⏭
          </button>
          <button className="btn btn-small" disabled={!state.playing} onClick={() => void api.musicFadeOut()}>
            {strings.fadeOut3}
          </button>
          <div className="spacer" />
          <button className={showList ? 'btn btn-small btn-on' : 'btn btn-small'} onClick={() => setShowList(!showList)}>
            {strings.playlist}
          </button>
        </div>
      </div>

      {showList && (
        <div
          className="playlist"
          onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void api.addMusic([...e.dataTransfer.files].map((f) => api.pathForFile(f)))
          }}
        >
          <div className="button-row tight">
            <button className="btn btn-small" onClick={() => void api.pickMusic(false)}>
              + {strings.musicFiles}
            </button>
            <button className="btn btn-small" onClick={() => void api.pickMusic(true)}>
              + {strings.musicFolder}
            </button>
            <label className="check small">
              <input type="checkbox" checked={a.shuffle} onChange={(e) => void api.updateAudio({ shuffle: e.target.checked })} />
              {strings.shuffle}
            </label>
            <div className="spacer" />
            <button className="btn btn-small btn-quiet" disabled={!a.playlist.length} onClick={() => void api.clearPlaylist()}>
              {strings.clearFiles}
            </button>
          </div>
          <div className="playlist-list">
            {a.playlist.map((m, i) => (
              <div
                key={`${m.path}-${i}`}
                className={i === state.index ? 'playlist-row is-on' : 'playlist-row'}
                onDoubleClick={() => void api.musicPlay(i)}
              >
                <span className="mono dim">{i + 1}</span>
                <span className="row-title">{m.path.split(/[\\/]/).pop()}</span>
                {!m.url && <span className="dim small">{strings.copying(0)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {state.item && (
        <div className="audio-item">
          <span className="tag tag-live">{strings.badgeLive}</span>
          <span className="row-title">{state.item.title}</span>
          <span className="mono small">
            {formatTime(state.item.time)} / {formatTime(state.item.duration || undefined)}
          </span>
          <button className="btn btn-small btn-quiet" onClick={() => void api.stopItemAudio()}>
            {strings.audioX}
          </button>
        </div>
      )}

      <div className="volumes">
        <Volume label={strings.background} value={a.musicVolume} onChange={(v) => void api.updateAudio({ musicVolume: v })} />
        <Volume label={strings.videoItems} value={a.itemsVolume} onChange={(v) => void api.updateAudio({ itemsVolume: v })} />
        <div className="meter" title={strings.outputLevel}>
          <span className="label-inline">{strings.outputLevel}</span>
          <div className="meter-bars">
            <MeterBar value={state.levels.l} />
            <MeterBar value={state.levels.r} />
          </div>
          <span className="dim small">L R</span>
        </div>
      </div>

      <label className="field-col">
        <span className="label-inline">{strings.outputDevice}</span>
        <select className="input select" value={a.device} onChange={(e) => void api.updateAudio({ device: e.target.value })}>
          <option value="">{strings.defaultDevice}</option>
          {devices
            .filter((d) => d.deviceId !== 'default')
            .map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || d.deviceId.slice(0, 12)}
              </option>
            ))}
        </select>
      </label>
      <label className="check small">
        <input type="checkbox" checked={a.autoDuck} onChange={(e) => void api.updateAudio({ autoDuck: e.target.checked })} />
        {strings.autoDuck}
      </label>
      <label className="check small">
        <input type="checkbox" checked={a.startAfterLast} onChange={(e) => void api.updateAudio({ startAfterLast: e.target.checked })} />
        {strings.startAfterLast}
      </label>
    </div>
  )
}

function Volume({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="volume">
      <span className="label-inline">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="mono small">{Math.round(value * 100)}%</span>
    </label>
  )
}

/** A vertical bar: green, then yellow, then red near the top. */
function MeterBar({ value }: { value: number }) {
  return (
    <div className="meter-bar">
      <div className="meter-fill" style={{ height: `${Math.round(Math.min(1, value) * 100)}%` }} />
    </div>
  )
}
