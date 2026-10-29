import type { StageRender, StageTimer } from '../../../shared/types'
import { strings } from '../strings'
import { formatClock, formatCountdown, useNow } from './clock'
import { ScreenView } from './ScreenView'

const noOverlays = { black: false, logo: false }

/** Seconds left on the participant countdown (negative = over time). */
export function timerSeconds(timer: StageTimer, now: number): number {
  return timer.running && timer.endsAt !== null ? (timer.endsAt - now) / 1000 : timer.remaining
}

/** Normal, yellow at 5 minutes, red at 0:00 (SPEC 7). */
export function timerColor(seconds: number): 'ok' | 'warn' | 'over' {
  if (seconds <= 0) return 'over'
  if (seconds <= 5 * 60) return 'warn'
  return 'ok'
}

/**
 * The stage screen for the people on the platform (SPEC 7): what the
 * audience sees, a large clock, the participant countdown, now and next,
 * item notes, and messages from the Stage tab.
 */
export function StageView({ stage }: { stage: StageRender }) {
  const now = useNow(250)
  const t = stage.timer
  const seconds = timerSeconds(t, now)
  const showTimer = t.running || t.remaining !== t.duration
  const countdown = stage.countdown ? (stage.countdown.endsAt - now) / 1000 : null

  return (
    <div className="stage">
      {stage.message && <div className="stage-message">{stage.message}</div>}
      <div className="stage-main">
        <div className="stage-left">
          <div className="stage-mirror">
            <ScreenView content={stage.mirror.content} text={stage.mirror.text} idle={stage.mirror.idle} overlays={noOverlays} />
          </div>
          <div className="stage-now">
            <span className="stage-label">{strings.stageNow}</span>
            <span className="stage-now-title">{stage.now?.title ?? '—'}</span>
            {stage.now?.detail && <span className="stage-detail">{stage.now.detail}</span>}
          </div>
          {stage.now?.notes && <div className="stage-notes">{stage.now.notes}</div>}
        </div>
        <div className="stage-right">
          <div className="stage-clock">{formatClock(now)}</div>
          {showTimer && (
            <div className={`stage-timer is-${timerColor(seconds)}`}>
              <span className="stage-label">{t.label}</span>
              <span className="stage-timer-time">{formatCountdown(seconds)}</span>
            </div>
          )}
          {countdown !== null && (
            <div className={`stage-timer is-${timerColor(countdown)}`}>
              <span className="stage-label">{stage.countdown!.label}</span>
              <span className="stage-timer-time">{formatCountdown(Math.max(0, countdown))}</span>
            </div>
          )}
          <div className="stage-next">
            <span className="stage-label">{strings.stageNext}</span>
            <span className="stage-next-title">{stage.next?.title ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
