import { useEffect, useState } from 'react'
import type { ScreensState, ServiceState, UpdateStatus } from '../../../shared/types'

const api = window.mediaConsole

/** The service state from the main process, kept up to date. */
export function useServiceState(): ServiceState | null {
  const [state, setState] = useState<ServiceState | null>(null)
  useEffect(() => {
    void api.getService().then(setState)
    return api.onServiceChanged(setState)
  }, [])
  return state
}

/** Screens, outputs and groups from the main process, kept up to date. */
export function useScreensState(): [ScreensState | null, (s: ScreensState) => void] {
  const [state, setState] = useState<ScreensState | null>(null)
  useEffect(() => {
    void api.getScreens().then(setState)
    return api.onScreensChanged(setState)
  }, [])
  return [state, setState]
}

/** Update status from the main process, kept up to date. */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    void api.getUpdate().then(setStatus)
    return api.onUpdateChanged(setStatus)
  }, [])
  return status
}
