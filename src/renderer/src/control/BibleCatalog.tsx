import { useEffect, useMemo, useState } from 'react'
import { normalize } from '../../../shared/bibleBooks'
import type { BibleCatalogEntry, BibleVersion } from '../../../shared/types'
import { strings } from '../strings'

const api = window.mediaConsole

/**
 * Download Bible versions inside the app (like BibleShow): search the free
 * online catalog by name or language, then download. After the download the
 * version works without internet.
 */
export function BibleCatalog({ installed, onClose }: { installed: BibleVersion[]; onClose: () => void }) {
  const [entries, setEntries] = useState<BibleCatalogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  // Filter by language name: some languages have more than one code in the catalog.
  const [lang, setLang] = useState('Spanish')
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [failed, setFailed] = useState<Record<string, string>>({})

  const load = (refresh = false) => {
    setLoading(true)
    void api.bibleCatalog(refresh).then((r) => {
      setEntries(r.entries)
      setError(r.error ?? null)
      setLoading(false)
    })
  }
  useEffect(() => load(), [])
  useEffect(() => api.onBibleDownload((p) => setProgress((old) => ({ ...old, [p.id]: p.fraction }))), [])
  // Esc closes this window only: it must not also clear the screens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const languages = useMemo(() => [...new Set(entries.map((e) => e.language))].sort((a, b) => a.localeCompare(b)), [entries])

  const words = normalize(query).split(/\s+/).filter(Boolean)
  const shown = entries.filter(
    (e) =>
      (lang === '' || e.language === lang) &&
      words.every((w) => normalize(`${e.name} ${e.abbrev} ${e.id} ${e.language}`).includes(w))
  )
  const installedIds = new Set(installed.map((b) => b.id))

  const download = async (e: BibleCatalogEntry) => {
    setProgress((old) => ({ ...old, [e.id]: 0 }))
    setFailed((old) => ({ ...old, [e.id]: '' }))
    const err = await api.downloadBible(e.id)
    setProgress((old) => {
      const next = { ...old }
      delete next[e.id]
      return next
    })
    if (err) setFailed((old) => ({ ...old, [e.id]: err }))
    load()
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog bible-catalog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 className="bible-title">{strings.downloadVersions}</h2>
          <div className="spacer" />
          <button className="btn btn-small btn-quiet" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="help small">{strings.catalogHelp}</p>

        <div className="button-row tight">
          <input
            className="input catalog-search"
            value={query}
            autoFocus
            placeholder={strings.catalogSearch}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input select" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">{strings.allLanguages}</option>
            {languages.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button className="btn btn-small btn-quiet" onClick={() => load(true)} title={strings.refreshCatalog}>
            ⟳
          </button>
        </div>

        {error && <p className="warn small">{entries.length ? strings.catalogOldList(error) : strings.catalogOffline(error)}</p>}
        {loading && entries.length === 0 && <p className="dim small">{strings.catalogLoading}</p>}

        <div className="catalog-list">
          {!loading && shown.length === 0 && entries.length > 0 && <p className="dim small">{strings.catalogNone}</p>}
          {shown.map((e) => {
            const p = progress[e.id]
            const copyrighted = /copyright/i.test(e.license)
            const isInstalled = e.installed || installedIds.has(`gb-${e.id}`)
            return (
              <div key={e.id} className="catalog-row">
                <div className="catalog-info" title={e.about}>
                  <span className="catalog-name">
                    {e.name} <span className="mono dim">{e.abbrev}</span>
                  </span>
                  <span className={copyrighted ? 'small warn' : 'small dim'}>
                    {e.language} · {e.license}
                  </span>
                  {failed[e.id] && <span className="small text-live">{failed[e.id]}</span>}
                </div>
                {p !== undefined ? (
                  <span className="mono small">{p < 0 ? strings.downloading : `${Math.round(p * 100)}%`}</span>
                ) : isInstalled ? (
                  <span className="small ok-text">{strings.installed}</span>
                ) : (
                  <button className="btn btn-small btn-primary" onClick={() => void download(e)}>
                    {strings.download}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {installed.length > 0 && (
          <>
            <span className="label-inline">{strings.versionsOnThisComputer}</span>
            <div className="catalog-installed">
              {installed.map((b) => (
                <div key={b.id} className="catalog-row">
                  <span className="catalog-name">
                    {b.name} <span className="mono dim">{b.abbrev}</span>
                  </span>
                  <button className="btn btn-small btn-quiet" onClick={() => void api.removeBible(b.id).then(() => load())}>
                    {strings.remove}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="dim small">{strings.licenseReminder}</p>
      </div>
    </div>
  )
}
