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
export type ItemType = 'video' | 'image' | 'slides' | 'bible'

export type ItemStatus = 'pending' | 'live' | 'done'

/** What happens when a video ends (SPEC section 6). Default: go to the idle screen. */
export type EndAction = 'next' | 'idle' | 'black' | 'hold' | 'loop'

/** How an image fills the screen. */
export type ImageFit = 'fit' | 'fill' | 'blur'

export interface Cue {
  time: number
  label: string
}

/** Options per item. Fields that do not apply to the item type are not used. */
export interface ItemSettings {
  /** Mark the item done when it ends. */
  autoDone: boolean
  // Video
  start?: number
  end?: number
  cues?: Cue[]
  /** 0..1 */
  volume?: number
  endAction?: EndAction
  /** Fade picture and sound in and out (1 s). */
  fade?: boolean
  // Image
  fit?: ImageFit
  /** Go to the next item after this many seconds. */
  autoNext?: number | null
  // Slides
  /** Go to the next page every N seconds. */
  autoAdvance?: number | null
  /** After the last page, start again at the first page. */
  loop?: boolean
  // Bible (SPEC section 6)
  /** Verses on one screen. 0 = as many as fit. */
  versesPerScreen?: number
  /** Split a long verse into more screens, with "…". */
  splitLong?: boolean
  refPosition?: 'below' | 'above' | 'hide'
  showVersion?: boolean
  /** Full screen, or lower third over video. */
  mode?: 'full' | 'lower'
  /** Show the same verses in a second version (bilingual services). */
  secondBibleId?: string | null
}

// ---- Bible ----

/** An imported Bible version. */
export interface BibleVersion {
  id: string
  name: string
  abbrev: string
  /** Number of verses: verseCounts[book - 1][chapter - 1]. */
  verseCounts: number[][]
}

/** A passage: one chapter, verses `from` to `to`. */
export interface BibleRef {
  bibleId: string
  book: number
  chapter: number
  from: number
  to: number
}

/** One screen of Bible text. */
export interface BibleScreen {
  text: string
  /** Second version, for bilingual services. */
  second?: string
  /** Reference on screen: "Salmos 23:4 · RV1909". */
  ref: string
  /** Short label for lists: "23:4 (1/2)". */
  label: string
  verse: number
}

export interface BibleHit {
  book: number
  chapter: number
  verse: number
  text: string
}

export type BibleSearchResult =
  | { kind: 'ref'; book: number; chapter?: number; from?: number; to?: number }
  | { kind: 'words'; hits: BibleHit[]; more: boolean }
  | { kind: 'none' }

/**
 * State of the local cached copy of an item's file. Slides also go through
 * "converting" (.pptx to PDF) and "rendering" (PDF pages to pictures).
 */
export type CacheState = 'copying' | 'converting' | 'rendering' | 'ready' | 'error'

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
  /** Width and height of the picture, when known. */
  width?: number
  height?: number
  notes?: string
  settings: ItemSettings
  /** Slides: one picture per page (media:// URLs), and the text of each page. */
  pageUrls?: string[]
  pageTexts?: string[]
  /** Bible: the passage. */
  bible?: BibleRef
}

export interface Service {
  id: string
  name: string
  date: string
  items: ServiceItem[]
  /** Bible passages shown in this service ("Today" chips). */
  bibleHistory?: BibleRef[]
}

// ---- Live state ----

/** The item on the content layer of a group. */
export interface ContentLayer {
  itemId: string
  type: ItemType
  url: string
  settings: ItemSettings
  /** Slides: the page shown now (0 = first) and the pictures of all pages. */
  page?: number
  pageUrls?: string[]
  /**
   * Changes every time something goes live. Groups that got the same item in
   * one "Go live" share the take, so their video is the same playback.
   */
  take: number
  playing: boolean
  /** Ask outputs to jump to this time (seconds). Changes with seekId. */
  seekTo?: number
  seekId?: number
  /** The video ended and the end action is "black" or "hold". */
  ended?: boolean
}

/** Text over everything else of the group (Bible verses now; messages later). */
export interface TextLayer {
  /** The order item, or null for "Show now" from the Bible panel. */
  itemId: string | null
  take: number
  title: string
  ref: BibleRef
  screens: BibleScreen[]
  /** The screen shown now. */
  index: number
  settings: ItemSettings
}

/** What a group shows now, by layer (SPEC section 4). More layers come later. */
export interface GroupLive {
  content: ContentLayer | null
  text: TextLayer | null
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
  bibles: BibleVersion[]
  /** Bible passages shown in this service ("Today" chips). */
  bibleHistory: BibleRef[]
  logoUrl?: string
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
  text: TextLayer | null
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
  updateItem(itemId: string, change: { notes?: string; settings?: Partial<ItemSettings>; width?: number; height?: number }): Promise<void>

  // Live
  setTarget(target: Target): Promise<void>
  /** Send an item to the current target (or one group). Slides start at `page`. */
  goLive(itemId: string, target?: Target, page?: number): Promise<void>
  /** Slides live in the target: go forward (+1) or back (-1) one page. */
  pageStep(delta: number): Promise<void>
  /** Slides live in the target: show this page. */
  showPage(itemId: string, page: number): Promise<void>
  next(): Promise<void>
  previous(): Promise<void>
  /** Clear the content of the current target, or of one group. */
  clear(groupId?: string): Promise<void>
  setPlaying(take: number, playing: boolean): Promise<void>
  seek(take: number, seconds: number): Promise<void>
  setOverlay(name: keyof Overlays, on: boolean): Promise<void>
  /** Remove the text layer of the target, of one group, or of all groups ("Clear text"). */
  clearText(groupId?: string | 'all'): Promise<void>

  // Bible
  /** Show a file dialog and import a Bible file. Returns an error text, or null. */
  importBible(): Promise<string | null>
  /** Import a Bible file dropped on the Bible panel. Returns an error text, or null. */
  importBibleFrom(path: string): Promise<string | null>
  removeBible(bibleId: string): Promise<void>
  getChapter(bibleId: string, book: number, chapter: number): Promise<string[]>
  searchBible(bibleId: string, query: string): Promise<BibleSearchResult>
  addBibleToOrder(ref: BibleRef): Promise<void>
  /** Show the passage now on the target, without adding it to the order. Starts at verse `startVerse`. */
  showBibleNow(ref: BibleRef, startVerse?: number): Promise<void>
  /** Bible text live in the target: show the screen of this verse. */
  showVerse(verse: number): Promise<void>
  /** Screens for a passage with the given settings (for the preview). */
  bibleScreens(ref: BibleRef, settings: Partial<ItemSettings>): Promise<BibleScreen[]>

  // Output windows
  onOutputRender(callback: (render: OutputRender) => void): () => void
  reportPlayback(info: PlaybackInfo & { ended: boolean }): void

  // Hidden PDF window
  onPdfJob(callback: (job: PdfJob) => void): () => void
  pdfPage(jobId: number, index: number, count: number, png: Uint8Array, text: string): void
  pdfDone(jobId: number, error: string | null): void
  pdfReady(): void
}

/** One PDF for the hidden window to turn into page pictures. */
export interface PdfJob {
  id: number
  /** The PDF file. */
  data: Uint8Array
  width: number
  height: number
}
