import type { MediaConsoleApi } from '../../shared/types'

declare global {
  interface Window {
    mediaConsole: MediaConsoleApi
  }
}
