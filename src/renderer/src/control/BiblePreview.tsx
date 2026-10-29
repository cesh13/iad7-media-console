import { useEffect, useState } from 'react'
import type { BibleScreen, ItemSettings, ServiceItem, ServiceState, TextLayer } from '../../../shared/types'
import { strings } from '../strings'
import { ScreenView } from '../view/ScreenView'
import { NotesAndStatus, TargetSelect } from './PreviewPanel'

const api = window.mediaConsole
const noOverlays = { black: false, logo: false }
const blackIdle = { kind: 'black' as const, media: [], interval: 8 }

/** Preview of a Bible item from the order: screens, layout options (SPEC 6, Preview-Bible mockup). */
export function BiblePreview({ state, item }: { state: ServiceState; item: ServiceItem }) {
  const ref = item.bible!
  const s = item.settings
  const [screens, setScreens] = useState<BibleScreen[]>([])
  const [index, setIndex] = useState(0)
  const set = (settings: Partial<ItemSettings>) => void api.updateItem(item.id, { settings })

  useEffect(() => {
    void api.bibleScreens(ref, s).then((list) => {
      setScreens(list)
      setIndex((i) => Math.min(i, Math.max(0, list.length - 1)))
    })
  }, [JSON.stringify(ref), JSON.stringify(s)])

  const live = state.groups.map((g) => g.live.text).find((t) => t?.itemId === item.id)
  const version = state.bibles.find((b) => b.id === ref.bibleId)
  const preview: TextLayer | null = screens.length
    ? { itemId: item.id, take: -1, title: item.title, ref, screens, index, settings: s }
    : null
  const verseCount = ref.to - ref.from + 1

  return (
    <section className="panel preview">
      <div className="preview-head">
        <h2 className="label">{strings.previewLabel}</h2>
        <div className="preview-title">
          <span className="selected-title">{item.title}</span>
          <span className="dim mono">
            {version?.abbrev ?? strings.bibleMissing} · {strings.versesToScreens(verseCount, screens.length)}
          </span>
        </div>
        <TargetSelect state={state} />
        <button className="btn btn-live" disabled={!version} onClick={() => void api.goLive(item.id)}>
          {strings.goLive} ⏎
        </button>
      </div>

      <div className="preview-box">
        {preview && <ScreenView content={null} text={preview} idle={blackIdle} overlays={noOverlays} />}
      </div>
      {screens[index] && screens[index].text.endsWith('…') && <p className="dim small">{strings.splitNote}</p>}

      <div className="chips screen-chips">
        {screens.map((sc, i) => {
          const isLive = live && live.index === i
          return (
            <button
              key={i}
              className={['chip', i === index ? 'is-on' : '', isLive ? 'chip-live' : ''].join(' ')}
              onClick={() => setIndex(i)}
              onDoubleClick={() => (live ? void api.showVerse(sc.verse) : void api.goLive(item.id))}
            >
              {sc.label}
              {isLive ? ` ${strings.badgeLive}` : ''}
            </button>
          )
        })}
      </div>

      <div className="option-grid">
        <div className="option">
          <span className="label-inline">{strings.versesPerScreen}</span>
          <div className="chips">
            {[1, 2, 3, 0].map((n) => (
              <button key={n} className={(s.versesPerScreen ?? 1) === n ? 'chip is-on' : 'chip'} onClick={() => set({ versesPerScreen: n })}>
                {n === 0 ? strings.fitMany : n}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={s.splitLong !== false} onChange={(e) => set({ splitLong: e.target.checked })} />
            {strings.splitLong}
          </label>
        </div>
        <div className="option">
          <span className="label-inline">{strings.reference}</span>
          <div className="chips">
            {(['below', 'above', 'hide'] as const).map((p) => (
              <button key={p} className={(s.refPosition ?? 'below') === p ? 'chip is-on' : 'chip'} onClick={() => set({ refPosition: p })}>
                {strings.refPositions[p]}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={s.showVersion !== false} onChange={(e) => set({ showVersion: e.target.checked })} />
            {strings.showVersion}
          </label>
        </div>
        <div className="option">
          <span className="label-inline">{strings.mode}</span>
          <div className="chips">
            <button className={s.mode !== 'lower' ? 'chip is-on' : 'chip'} onClick={() => set({ mode: 'full' })}>
              {strings.modeFull}
            </button>
            <button className={s.mode === 'lower' ? 'chip is-on' : 'chip'} onClick={() => set({ mode: 'lower' })}>
              {strings.modeLower}
            </button>
          </div>
        </div>
        <div className="option">
          <span className="label-inline">{strings.secondVersion}</span>
          <select
            className="input select"
            value={s.secondBibleId ?? ''}
            onChange={(e) => set({ secondBibleId: e.target.value || null })}
          >
            <option value="">{strings.none}</option>
            {state.bibles
              .filter((b) => b.id !== ref.bibleId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.abbrev} · {b.name}
                </option>
              ))}
          </select>
          <span className="dim small">{strings.licenseNote}</span>
        </div>
      </div>

      <NotesAndStatus item={item} />
    </section>
  )
}

/** Preview of a song (.txt): one stanza per screen, full screen or lower third. */
export function SongPreview({ state, item }: { state: ServiceState; item: ServiceItem }) {
  const s = item.settings
  const [index, setIndex] = useState(0)
  const list = item.stanzas ?? []
  const screens: BibleScreen[] = list.map((text, i) => ({ text, ref: item.title, label: `${i + 1}/${list.length}`, verse: i + 1 }))
  const live = state.groups.map((g) => g.live.text).find((t) => t?.itemId === item.id)
  const ready = item.cache === 'ready' && screens.length > 0
  const set = (settings: Partial<ItemSettings>) => void api.updateItem(item.id, { settings })
  const preview: TextLayer | null = ready ? { itemId: item.id, take: -1, title: item.title, screens, index, settings: s } : null

  return (
    <section className="panel preview">
      <div className="preview-head">
        <h2 className="label">{strings.previewLabel}</h2>
        <div className="preview-title">
          <span className="selected-title">{item.title}</span>
          <span className="dim mono">{ready ? strings.stanzaCount(list.length) : strings.cacheStates(item)}</span>
        </div>
        <TargetSelect state={state} />
        <button className="btn btn-live" disabled={!ready} onClick={() => void api.goLive(item.id)}>
          {strings.goLive} ⏎
        </button>
      </div>
      <div className="preview-box">
        {preview && <ScreenView content={null} text={preview} idle={blackIdle} overlays={noOverlays} />}
      </div>
      <div className="chips screen-chips">
        {screens.map((sc, i) => (
          <button
            key={i}
            className={['chip', i === index ? 'is-on' : '', live?.index === i ? 'chip-live' : ''].join(' ')}
            onClick={() => setIndex(i)}
            onDoubleClick={() => (live ? void api.showVerse(sc.verse) : void api.goLive(item.id))}
          >
            {sc.label}
          </button>
        ))}
      </div>
      <div className="option-grid">
        <div className="option">
          <span className="label-inline">{strings.mode}</span>
          <div className="chips">
            <button className={s.mode !== 'lower' ? 'chip is-on' : 'chip'} onClick={() => set({ mode: 'full' })}>
              {strings.modeFull}
            </button>
            <button className={s.mode === 'lower' ? 'chip is-on' : 'chip'} onClick={() => set({ mode: 'lower' })}>
              {strings.modeLower}
            </button>
          </div>
        </div>
        <div className="option">
          <span className="label-inline">{strings.songTitle}</span>
          <div className="chips">
            {(['hide', 'above', 'below'] as const).map((p) => (
              <button key={p} className={(s.refPosition ?? 'hide') === p ? 'chip is-on' : 'chip'} onClick={() => set({ refPosition: p })}>
                {strings.refPositions[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <NotesAndStatus item={item} />
    </section>
  )
}
