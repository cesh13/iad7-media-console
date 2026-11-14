import { useEffect, useState } from 'react'
import type { HymnalState, ScreensState, ServiceState, UpdateStatus } from '../../../shared/types'

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

// The hymnal list is large (all hymns with their pictures), so the window asks
// for it once and all parts of the window share that copy.
let hymnal: HymnalState | null = null
const hymnalListeners = new Set<(s: HymnalState) => void>()
let hymnalAsked = false

function setHymnal(state: HymnalState): void {
  hymnal = state
  for (const listener of hymnalListeners) listener(state)
}

/** The hymnal (folder, hymns) from the main process, kept up to date. */
export function useHymnalState(): HymnalState | null {
  const [state, setState] = useState<HymnalState | null>(hymnal)
  useEffect(() => {
    hymnalListeners.add(setState)
    if (!hymnalAsked) {
      hymnalAsked = true
      void api.getHymnal().then(setHymnal)
      api.onHymnalChanged(setHymnal)
    } else if (hymnal) {
      setState(hymnal)
    }
    return () => void hymnalListeners.delete(setState)
  }, [])
  return state
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
