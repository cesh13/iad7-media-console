// Types shared by the main process, the preload script and the renderer.

/** One physical screen as Electron reports it, plus our stable key. */
export interface ScreenInfo {
  electronId: number
  /** label + resolution + position. Used to find the same screen again later. */
  displayKey: string
  label: string
  width: number
  height: number
  x: number
  y: number
  scaleFactor: number
  isPrimary: boolean
}

/** One physical screen that the team uses for output (SPEC section 4). */
export interface Output {
  id: string
  displayKey: string
  name: string
}

export interface Settings {
  outputs: Output[]
  currentServiceId?: string
}

/** A saved output, and the screen it matches now (if any). */
export interface OutputStatus {
  output: Output
  screen: ScreenInfo | null
}

/** Everything the control window shows about screens. */
export interface ScreensState {
  screens: ScreenInfo[]
  outputs: OutputStatus[]
  testOpen: number[]
}

/** Data the main process sends to a test window. */
export interface TestInfo {
  index: number
  screen: ScreenInfo
  outputName: string | null
}

// ---- Service order (SPEC section 4) ----

/** Step 2 supports only video and image. Other types come in later steps. */
export type ItemType = 'video' | 'image'

export type ItemStatus = 'pending' | 'live' | 'done'

/** State of the local cached copy of an item's file. */
export type CacheState = 'copying' | 'ready' | 'error'

export interface ServiceItem {
  id: string
  type: ItemType
  title: string
  /** Source file (original). */
  path: string
  /** Cached copy used for playback. */
  localCopyPath?: string
  /** media:// URL of the cached copy, when it is ready. */
  url?: string
  cache: CacheState
  /** 0..1 while copying. */
  cacheProgress?: number
  cacheError?: string
  status: ItemStatus
  /** Video length in seconds, when known. */
  duration?: number
}

export interface Service {
  id: string
  name: string
  date: string
  items: ServiceItem[]
}

// ---- Live state ----

/** What a group shows now. */
export interface LiveState {
  itemId: string
  /** Changes every time the item goes live, so outputs restart the media. */
  take: number
  playing: boolean
  /** Ask outputs to jump to this time (seconds). Changes with seekId. */
  seekTo?: number
  seekId?: number
}

/** Step 2 has one group, "Main", with all named outputs. */
export interface Group {
  id: string
  name: string
  outputIds: string[]
  live: LiveState | null
}

/** Playback position, reported by the first output of a group. */
export interface PlaybackInfo {
  itemId: string
  take: number
  currentTime: number
  duration: number
  playing: boolean
}

/** Everything the control window shows about the service. */
export interface ServiceState {
  service: Service
  group: Group
  playback: PlaybackInfo | null
  /** The item that "Next" makes live (blue NEXT mark). */
  nextItemId: string | null
}

export interface AddFilesResult {
  added: number
  /** Names of files that are not a supported type. */
  skipped: string[]
}

/** What one output window must render. */
export interface OutputRender {
  outputName: string
  /** Only one output per group plays sound, so the audio is not doubled. */
  audio: boolean
  live: null | {
    take: number
    type: ItemType
    url: string
    playing: boolean
    seekTo?: number
    seekId?: number
  }
}

export interface MediaConsoleApi {
  // Screens (step 1)
  getScreens(): Promise<ScreensState>
  onScreensChanged(callback: (state: ScreensState) => void): () => void
  saveOutput(displayKey: string, name: string): Promise<ScreensState>
  removeOutput(outputId: string): Promise<ScreensState>
  openTest(electronIds: number[]): Promise<ScreensState>
  closeTests(): Promise<ScreensState>
  onTestInfo(callback: (info: TestInfo) => void): () => void

  // Service order (step 2)
  getService(): Promise<ServiceState>
  onServiceChanged(callback: (state: ServiceState) => void): () => void
  /** Show a file dialog and add the chosen files. */
  pickFiles(): Promise<AddFilesResult>
  /** Add files dropped on the window. */
  addFiles(paths: string[]): Promise<AddFilesResult>
  /** Path of a dropped File (Electron no longer gives File.path). */
  pathForFile(file: File): string
  removeItem(itemId: string): Promise<void>
  retryCopy(itemId: string): Promise<void>
  /** The control window reads video length from the file and reports it. */
  setDuration(itemId: string, seconds: number): Promise<void>
  moveItem(itemId: string, toIndex: number): Promise<void>
  setItemStatus(itemId: string, status: ItemStatus): Promise<void>
  goLive(itemId: string): Promise<void>
  next(): Promise<void>
  previous(): Promise<void>
  clear(): Promise<void>
  setPlaying(playing: boolean): Promise<void>
  seek(seconds: number): Promise<void>

  // Output windows
  onOutputRender(callback: (render: OutputRender) => void): () => void
  reportPlayback(info: Omit<PlaybackInfo, 'itemId'> & { ended: boolean }): void
}
