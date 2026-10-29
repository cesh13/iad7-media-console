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

/** A file used by the app itself (logo, idle background), with its cached copy. */
export interface MediaRef {
  path: string
  type: 'image' | 'video'
  cachedPath?: string
  /** media:// URL of the cached copy, when it is ready. */
  url?: string
}

/**
 * What a group shows when nothing is live (SPEC section 8).
 * - black: black screen
 * - logo: the church logo (Settings.logo)
 * - background: the group's first idle file (image, or video in a loop)
 * - loop: all idle files one after the other (announcements)
 */
export type IdleKind = 'black' | 'logo' | 'background' | 'loop'

/** A group of screens that show the same content (SPEC section 4). */
export interface GroupConfig {
  id: string
  name: string
  outputIds: string[]
  idle: IdleKind
  idleMedia: MediaRef[]
  /** Seconds each image shows in an idle loop. */
  idleInterval: number
}

export interface Settings {
  outputs: Output[]
  groups: GroupConfig[]
  logo?: MediaRef
  currentServiceId?: string
}

/** A saved output, and the screen it matches now (if any). */
export interface OutputStatus {
  output: Output
  screen: ScreenInfo | null
}

/** Everything the screens page shows. */
export interface ScreensState {
  screens: ScreenInfo[]
  outputs: OutputStatus[]
  testOpen: number[]
  groups: GroupConfig[]
  logo?: MediaRef
}

/** Data the main process sends to a test window. */
export interface TestInfo {
  index: number
  screen: ScreenInfo
  outputName: string | null
}

// ---- Service order (SPEC section 4) ----

/** Item types supported so far. More types come in later steps. */
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

/** The item on the content layer of a group. */
export interface ContentLayer {
  itemId: string
  type: ItemType
  url: string
  /**
   * Changes every time something goes live. Groups that got the same item in
   * one "Go live" share the take, so their video is the same playback.
   */
  take: number
  playing: boolean
  /** Ask outputs to jump to this time (seconds). Changes with seekId. */
  seekTo?: number
  seekId?: number
}

/** What a group shows now, by layer (SPEC section 4). More layers come later. */
export interface GroupLive {
  content: ContentLayer | null
}

/** Where "Go live" sends an item: one group, or all groups. */
export type Target = 'all' | string

/** Playback position, reported by the output that plays the sound. */
export interface PlaybackInfo {
  take: number
  currentTime: number
  duration: number
  playing: boolean
}

/** Overlays over all screens, from the top bar buttons. */
export interface Overlays {
  black: boolean
  logo: boolean
}

export interface GroupView {
  config: GroupConfig
  live: GroupLive
}

/** Everything the control window shows about the service. */
export interface ServiceState {
  service: Service
  groups: GroupView[]
  target: Target
  /** By take. */
  playback: Record<number, PlaybackInfo>
  /** The item that "Next" makes live (blue NEXT mark). */
  nextItemId: string | null
  overlays: Overlays
  logoReady: boolean
}

export interface AddFilesResult {
  added: number
  /** Names of files that are not a supported type. */
  skipped: string[]
}

/** What one output window must render. */
export interface OutputRender {
  outputName: string
  groupName: string | null
  /** Only one output plays the sound of each take, so the audio is not doubled. */
  audioTakes: number[]
  content: ContentLayer | null
  idle: { kind: IdleKind; media: { type: 'image' | 'video'; url: string }[]; interval: number }
  logoUrl?: string
  overlays: Overlays
}

export interface MediaConsoleApi {
  // Screens and groups
  getScreens(): Promise<ScreensState>
  onScreensChanged(callback: (state: ScreensState) => void): () => void
  saveOutput(displayKey: string, name: string): Promise<ScreensState>
  removeOutput(outputId: string): Promise<ScreensState>
  openTest(electronIds: number[]): Promise<ScreensState>
  closeTests(): Promise<ScreensState>
  onTestInfo(callback: (info: TestInfo) => void): () => void
  addGroup(name: string): Promise<void>
  removeGroup(groupId: string): Promise<void>
  updateGroup(groupId: string, change: Partial<Pick<GroupConfig, 'name' | 'idle' | 'idleInterval'>>): Promise<void>
  /** Put an output in a group (null: no group). An output is in one group at most. */
  assignOutput(outputId: string, groupId: string | null): Promise<void>
  /** Show a file dialog and set the group's idle files. */
  pickIdleMedia(groupId: string): Promise<void>
  clearIdleMedia(groupId: string): Promise<void>
  pickLogo(): Promise<void>

  // Service order
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

  // Live
  setTarget(target: Target): Promise<void>
  /** Send an item to the current target. */
  goLive(itemId: string): Promise<void>
  next(): Promise<void>
  previous(): Promise<void>
  /** Clear the content of the current target, or of one group. */
  clear(groupId?: string): Promise<void>
  setPlaying(take: number, playing: boolean): Promise<void>
  seek(take: number, seconds: number): Promise<void>
  setOverlay(name: keyof Overlays, on: boolean): Promise<void>

  // Output windows
  onOutputRender(callback: (render: OutputRender) => void): () => void
  reportPlayback(info: PlaybackInfo & { ended: boolean }): void
}
