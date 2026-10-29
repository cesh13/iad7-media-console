import { useEffect, useState } from 'react'
import { shownStyle } from '../../../shared/textStyle'
import type { BibleScreen, ItemSettings, ServiceItem, ServiceState, TextLayer } from '../../../shared/types'
import { strings } from '../strings'
import { ScreenView } from '../view/ScreenView'
import { NotesAndStatus, TargetSelect } from './PreviewPanel'
import { previewIdle, TextStyleDialog } from './TextStyleDialog'

const api = window.mediaConsole
const noOverlays = { black: false, logo: false }

/** Preview of a Bible item from the order: screens, layout options (SPEC 6, Preview-Bible mockup). */
export function BiblePreview({ state, item }: { state: ServiceState; item: ServiceItem }) {
  const ref = item.bible!
  const s = item.settings
  const [screens, setScreens] = useState<BibleScreen[]>([])
  const [index, setIndex] = useState(0)
  const [styleOpen, setStyleOpen] = useState(false)
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
    ? { itemId: item.id, take: -1, title: item.title, ref, screens, index, settings: s, style: shownStyle(state.textStyles.bible, s) }
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
        {preview && <ScreenView content={null} text={preview} idle={previewIdle(state)} overlays={noOverlays} />}
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
        <ItemBackground item={item} onStyle={() => setStyleOpen(true)} />
      </div>

      <NotesAndStatus item={item} />
      {styleOpen && <TextStyleDialog state={state} kind="bible" onClose={() => setStyleOpen(false)} />}
    </section>
  )
}

/** Preview of a song or typed text: one stanza per screen, full screen or lower third. The text can be typed or changed here. */
export function SongPreview({ state, item }: { state: ServiceState; item: ServiceItem }) {
  const s = item.settings
  const [index, setIndex] = useState(0)
  const [styleOpen, setStyleOpen] = useState(false)
  const list = item.stanzas ?? []
  const typed = !item.path
  // A new typed item opens with the editor.
  const [editing, setEditing] = useState(typed && list.length === 0)
  const [draft, setDraft] = useState(list.join('\n\n'))
  const [title, setTitle] = useState(item.title)
  useEffect(() => setTitle(item.title), [item.title])
  const screens: BibleScreen[] = list.map((text, i) => ({ text, ref: item.title, label: `${i + 1}/${list.length}`, verse: i + 1 }))
  const live = state.groups.map((g) => g.live.text).find((t) => t?.itemId === item.id)
  const ready = item.cache === 'ready' && screens.length > 0
  const set = (settings: Partial<ItemSettings>) => void api.updateItem(item.id, { settings })
  const shown = Math.min(index, Math.max(0, screens.length - 1))
  const preview: TextLayer | null = ready
    ? { itemId: item.id, take: -1, title: item.title, screens, index: shown, settings: s, style: shownStyle(state.textStyles.song, s) }
    : null

  const save = () => {
    // An empty line starts a new screen.
    void api.updateItem(item.id, { stanzas: draft.split(/\n[ \t]*\n/) })
    setEditing(false)
  }

  return (
    <section className="panel preview">
      <div className="preview-head">
        <h2 className="label">{strings.previewLabel}</h2>
        <div className="preview-title">
          <input
            className="input title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== item.title && void api.updateItem(item.id, { title })}
          />
          <span className="dim mono">{ready ? strings.stanzaCount(list.length) : typed ? strings.noTextYet : strings.cacheStates(item)}</span>
        </div>
        <TargetSelect state={state} />
        <button className="btn btn-live" disabled={!ready || editing} onClick={() => void api.goLive(item.id)}>
          {strings.goLive} ⏎
        </button>
      </div>

      {editing ? (
        <div className="song-editor">
          <textarea
            className="input song-text"
            value={draft}
            autoFocus
            placeholder={strings.songTextPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl+Enter saves.
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                save()
              }
            }}
          />
          <div className="button-row tight">
            <span className="dim small">{typed ? strings.songTextHelp : strings.songFileEditNote}</span>
            <div className="spacer" />
            {list.length > 0 && (
              <button
                className="btn btn-small btn-quiet"
                onClick={() => {
                  setDraft(list.join('\n\n'))
                  setEditing(false)
                }}
              >
                {strings.cancel}
              </button>
            )}
            <button className="btn btn-small btn-primary" onClick={save}>
              {strings.saveText}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="preview-box">
            {preview && <ScreenView content={null} text={preview} idle={previewIdle(state)} overlays={noOverlays} />}
          </div>
          <div className="chips screen-chips">
            {screens.map((sc, i) => (
              <button
                key={i}
                className={['chip', i === shown ? 'is-on' : '', live?.index === i ? 'chip-live' : ''].join(' ')}
                onClick={() => setIndex(i)}
                onDoubleClick={() => (live ? void api.showVerse(sc.verse) : void api.goLive(item.id))}
              >
                {sc.label}
              </button>
            ))}
            {item.cache === 'ready' && (
              <button
                className="chip"
                onClick={() => {
                  setDraft(list.join('\n\n'))
                  setEditing(true)
                }}
              >
                ✎ {strings.editText}
              </button>
            )}
          </div>
        </>
      )}

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
        <ItemBackground item={item} onStyle={() => setStyleOpen(true)} />
      </div>
      <NotesAndStatus item={item} />
      {styleOpen && <TextStyleDialog state={state} kind="song" onClose={() => setStyleOpen(false)} />}
    </section>
  )
}

/** The item's own background picture or video, and the button for the shared text style. */
function ItemBackground({ item, onStyle }: { item: ServiceItem; onStyle: () => void }) {
  const own = item.settings.background
  return (
    <div className="option">
      <span className="label-inline">{strings.itemBackground}</span>
      <div className="button-row tight">
        <span className={own ? 'mono small path' : 'dim small'}>{own ? own.path.split(/[\\/]/).pop() : strings.useStyleBackground}</span>
      </div>
      <div className="button-row tight">
        <button className="btn btn-small" onClick={() => void api.pickItemBackground(item.id)}>
          {strings.chooseFile}
        </button>
        {own && (
          <button className="btn btn-small btn-quiet" onClick={() => void api.updateItem(item.id, { settings: { background: null } })}>
            {strings.clearFiles}
          </button>
        )}
        <button className="btn btn-small btn-quiet" onClick={onStyle}>
          {strings.textStyleButton}
        </button>
      </div>
    </div>
  )
}
