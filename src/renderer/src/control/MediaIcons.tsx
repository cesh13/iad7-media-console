/** Standard media player icons (play, pause, skip 10 s, tracks, volume). */
export type MediaIconName = 'play' | 'pause' | 'back10' | 'forward10' | 'prevTrack' | 'nextTrack' | 'volume'

export function MediaIcon({ name, size = 16 }: { name: MediaIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'play' && <path d="M8 5v14l11-7z" fill="currentColor" />}
      {name === 'pause' && <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />}
      {name === 'prevTrack' && <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" fill="currentColor" />}
      {name === 'nextTrack' && <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" fill="currentColor" />}
      {(name === 'back10' || name === 'forward10') && (
        <>
          <path
            d={name === 'back10' ? 'M5.5 9A7.5 7.5 0 1 1 4.5 13' : 'M18.5 9A7.5 7.5 0 1 0 19.5 13'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d={name === 'back10' ? 'M3.5 4.5v5h5' : 'M20.5 4.5v5h-5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">
            10
          </text>
        </>
      )}
      {name === 'volume' && (
        <>
          <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
          <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

/** A small square button with a media icon. The label is the tooltip and the screen-reader name. */
export function MediaButton(props: {
  icon: MediaIconName
  label: string
  onClick: () => void
  disabled?: boolean
  quiet?: boolean
}) {
  const { icon, label, onClick, disabled, quiet } = props
  return (
    <button
      className={quiet ? 'btn btn-small btn-icon btn-media btn-quiet' : 'btn btn-small btn-icon btn-media'}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <MediaIcon name={icon} />
    </button>
  )
}
