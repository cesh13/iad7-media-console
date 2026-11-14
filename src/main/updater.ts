import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

/**
 * Updates over the internet (SPEC 12). New versions are on GitHub Releases.
 * The app looks once when it starts, downloads a new version quietly, and
 * installs it when the app closes. It never restarts by itself, so an update
 * never stops a service. Without internet nothing happens.
 */

let status: UpdateStatus = { current: app.getVersion(), available: null, percent: null, ready: false }
let notify: (status: UpdateStatus) => void = () => {}

function set(change: Partial<UpdateStatus>): void {
  status = { ...status, ...change }
  notify(status)
}

export function updateStatus(): UpdateStatus {
  return status
}

/** Only the installed app updates: not the dev copy and not the portable .exe. */
function canUpdate(): boolean {
  return app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR
}

export function connectUpdater(onStatus: (status: UpdateStatus) => void): void {
  notify = onStatus
  if (!canUpdate()) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.on('update-available', (info) => set({ available: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => set({ percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => set({ available: info.version, percent: null, ready: true }))
  // No internet, or GitHub cannot be reached: try again at the next start.
  autoUpdater.on('error', (err) => {
    console.warn('Update check failed:', err.message)
    if (!status.ready) set({ available: null, percent: null })
  })
  void autoUpdater.checkForUpdates().catch(() => {})
}

/** "Restart now": close the app, install the downloaded version, and open it again. */
export function installUpdateNow(): void {
  if (status.ready) autoUpdater.quitAndInstall(true, true)
}
