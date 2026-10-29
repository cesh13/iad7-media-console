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
  type: 'image' | 'video' | 'audio'
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
  /**
   * Stage view (SPEC 7): the screens show clock, timer, now, next, notes and
   * messages for the people on the platform, with a copy of what the audience sees.
   */
  stageView?: boolean
}

/** A lower-third message the team saved (name and role, notices). */
export interface SavedMessage {
  id: string
  line1: string
  line2: string
}

export interface Settings {
  outputs: Output[]
  groups: GroupConfig[]
  logo?: MediaRef
  currentServiceId?: string
  /** The watched shared folder, for example \\MEDIA-PC\Compartida. */
  sharedFolder?: string
  audio?: AudioSettings
  messages?: SavedMessage[]
  /** Library root folders (Himnario, Videos, Fondos, …). */
  library?: LibraryFolder[]
  favorites?: Favorite[]
  /** How Bible text and song text look on the screens. */
  textStyles?: TextStyles
}

// ---- Text styles (Bible, songs) ----

/**
 * What is behind full-screen text:
 * - idle: the idle background of the group (picture or video), if it has one
 * - black: black
 * - color: one color
 * - media: a picture or a video (in a loop)
 */
export type TextBackground = 'idle' | 'black' | 'color' | 'media'

export interface TextStyle {
  font: 'serif' | 'sans'
  /** Largest text size in % of the normal size (the text is made smaller when it does not fit). */
  size: number
  /** Text color, for example "#ffffff". */
  color: string
  align: 'center' | 'left'
  /** A soft shadow behind the letters, so they are easy to read over pictures. */
  shadow: boolean
  uppercase: boolean
  background: TextBackground
  backgroundColor: string
  backgroundMedia?: MediaRef
  /** Darken the background picture or video: 0 (not darker) to 0.9. */
  dim: number
}

/** Bible: Bible passages and lower-third messages. Song: songs and typed text (announcements). */
export type TextStyleKind = 'bible' | 'song'

export type TextStyles = Record<TextStyleKind, TextStyle>

/** The style that a text layer uses now: the saved style, with the item's own background if it has one. */
export interface ShownTextStyle extends TextStyle {
  /** media:// URL and type of the background picture or video. */
  media?: { type: 'image' | 'video'; url: string }
}

// ---- Library (SPEC 5.2) and hotkeys (SPEC 5.6) ----

export interface LibraryFolder {
  path: string
  name: string
}

/**
 * A favorite: a file, or an action. Favorites with a hotkey (1 = F1 … 8 = F8)
 * go live with one press.
 */
export interface Favorite {
  id: string
  kind: 'file' | 'logo' | 'black' | 'countdown'
  title: string
  path?: string
  type?: ItemType
  hotkey?: number
  /** Countdown: seconds. */
  seconds?: number
}

/** One file or folder in the library browser. */
export interface LibEntry {
  name: string
  path: string
  dir: boolean
  type: ItemType | null
  size: number
  /** Last change time (ms). */
  mtime: number
  /** How often and when it went live. */
  used?: { count: number; last: number }
  /** Folders: number of files inside. */
  files?: number
}

/** A saved service, for the selector and "past services". */
export interface ServiceSummary {
  id: string
  name: string
  date: string
  items: number
}

// ---- Stage (SPEC 7) ----

/** The participant countdown ("Sermón 30:00"). */
export interface StageTimer {
  label: string
  /** Seconds set for the timer. */
  duration: number
  running: boolean
  /** While running: the time (ms) when it reaches 0:00. */
  endsAt: number | null
  /** While stopped: seconds left (negative = over time). */
  remaining: number
}

export interface StageRender {
  timer: StageTimer
  /** A countdown item that is live and set to "also show on Stage". */
  countdown: { label: string; endsAt: number } | null
  message: string | null
  now: { title: string; notes?: string; detail?: string } | null
  next: { title: string } | null
  /** What the audience sees now (the main group). */
  mirror: { content: ContentLayer | null; text: TextLayer | null; idle: OutputRender['idle'] }
}

// ---- Audio (SPEC 5.6) ----

export interface AudioSettings {
  playlist: MediaRef[]
  shuffle: boolean
  /** 0..1 */
  musicVolume: number
  /** Volume of videos and audio items. 0..1 */
  itemsVolume: number
  /** Audio output device id ('' = the system default). */
  device: string
  /** Lower the background music when a video plays. */
  autoDuck: boolean
  /** Start the background music when the last item of the order ends. */
  startAfterLast: boolean
}

/** What the control window shows in the Audio tab. */
export interface AudioState {
  settings: AudioSettings
  /** Index in the playlist of the track now (or next). */
  index: number
  playing: boolean
  /** Music is lower because a video plays. */
  ducked: boolean
  position: { time: number; duration: number } | null
  /** An audio item from the order that plays now. */
  item: { itemId: string; title: string; playing: boolean; time: number; duration: number } | null
  /** Output level, 0..1 for left and right. */
  levels: { l: number; r: number }
}

/** What the hidden audio window must play. */
export interface AudioRender {
  device: string
  music: { url: string; take: number; playing: boolean; volume: number; fadeOutId?: number } | null
  item: { url: string; take: number; playing: boolean; volume: number } | null
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
  /** Electron id of the screen that shows the control window. No output window opens there. */
  consoleScreen: number | null
}

/** Data the main process sends to a test window. */
export interface TestInfo {
  index: number
  screen: ScreenInfo
  outputName: string | null
}

// ---- Service order (SPEC section 4) ----

/** Item types supported so far. More types come in later steps. */
export type ItemType = 'video' | 'image' | 'slides' | 'bible' | 'song' | 'folder' | 'audio' | 'countdown'

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
  /** Stop the background music when this video goes live. */
  stopMusic?: boolean
  /** Audio output device for this video ('' or missing = the main output device). */
  audioDevice?: string
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
  // Countdown (SPEC 6)
  /** Count a duration, or count to a clock time. */
  countdownMode?: 'duration' | 'until'
  /** Seconds, for "duration". */
  countdownSeconds?: number
  /** "HH:MM", for "until". */
  untilTime?: string
  /** Text above the time, for example "El culto inicia en". */
  textAbove?: string
  /** At 0:00: go to the next item, show the logo, or stay at 0:00. */
  atZero?: 'next' | 'logo' | 'stay'
  showOnStage?: boolean
  // Song and Bible text
  /** A background picture or video only for this item (instead of the style background). */
  background?: MediaRef | null
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

/** A version in the online catalog (getbible.net). */
export interface BibleCatalogEntry {
  /** Catalog id, for example "valera". */
  id: string
  name: string
  /** Short name in the version selector, for example "RV1909". */
  abbrev: string
  /** Language code ("es") and name ("Spanish"). */
  lang: string
  language: string
  /** License text from the catalog, for example "Public Domain". */
  license: string
  about: string
  installed: boolean
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
  /** Song (.txt): the stanzas, one per screen. */
  stanzas?: string[]
  /** Folder: the chosen file, and that file as an item (copied and converted like any item). */
  folderChoice?: string
  child?: ServiceItem
  /** Folder: number of files and index progress (0..1 while indexing, null when ready). */
  folder?: { count: number; progress: number | null }
}

/** One file or subfolder in the shared folder. */
export interface SharedEntry {
  /** Path inside the shared folder, with "/". */
  rel: string
  path: string
  name: string
  /** rel of the folder it is in ('' = the shared folder itself). */
  parent: string
  dir: boolean
  type: ItemType | null
  /** Not seen yet by the team (dot, "N NEW"). */
  isNew: boolean
  /** Last change time of the file (ms). */
  mtime?: number
  /** Files: waiting, copying, converting, rendering, ready or error. */
  state: 'waiting' | CacheState
  progress?: number
  error?: string
  /** Folders: true when nothing inside changed for a few seconds. */
  ready?: boolean
}

export interface SharedState {
  root: string | null
  /** scanning: the first look at the folder. tooBig: too many media files, not watched. */
  status: 'off' | 'scanning' | 'watching' | 'unreachable' | 'tooBig'
  error?: string
  entries: SharedEntry[]
}

/** One file in a folder item (for example one hymn). */
export interface FolderEntry {
  path: string
  name: string
  /** The number at the start of the file name ("045 Santo.pptx" → 45). */
  number: number | null
  title: string
  type: ItemType
  /** The first line of text in the file. */
  snippet: string
}

export interface Service {
  id: string
  name: string
  date: string
  items: ServiceItem[]
  /** Bible passages shown in this service ("Today" chips). */
  bibleHistory?: BibleRef[]
  /** When the first item went live (ms), for the elapsed time in the top bar. */
  startedAt?: number
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
  /** Countdown: the time (ms) when it reaches 0:00. */
  endsAt?: number
}

/** Text over everything else of the group (Bible verses now; messages later). */
export interface TextLayer {
  /** The order item, or null for "Show now" from the Bible panel. */
  itemId: string | null
  take: number
  title: string
  /** Bible text only. */
  ref?: BibleRef
  screens: BibleScreen[]
  /** The screen shown now. */
  index: number
  settings: ItemSettings
  /** How the text looks (font, color, background). */
  style?: ShownTextStyle
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
  /** Groups with stage view: what their screens show. */
  stage?: StageRender
}

/** Changes to the order that "Undo" can take back. */
export type UndoKind = 'add' | 'remove' | 'move' | 'copy'

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
  stageTimer: StageTimer
  stageMessage: string | null
  messages: SavedMessage[]
  services: ServiceSummary[]
  library: LibraryFolder[]
  favorites: Favorite[]
  logoUrl?: string
  textStyles: TextStyles
  /** The change that "Undo" takes back, or null when there is nothing to undo. */
  undo: UndoKind | null
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
  /** Sound of videos: master volume (0..1) and output device. */
  itemsVolume: number
  audioDevice: string
  content: ContentLayer | null
  text: TextLayer | null
  idle: { kind: IdleKind; media: { type: 'image' | 'video'; url: string }[]; interval: number }
  logoUrl?: string
  overlays: Overlays
  /** Groups with stage view: the stage layout instead of the normal picture. */
  stage?: StageRender
}

export interface MediaConsoleApi {
  // Screens and groups
  getScreens(): Promise<ScreensState>
  onScreensChanged(callback: (state: ScreensState) => void): () => void
  saveOutput(displayKey: string, name: string): Promise<ScreensState>
  removeOutput(outputId: string): Promise<ScreensState>
  openTest(electronIds: number[]): Promise<ScreensState>
  /** Close the test windows on these screens, or all of them when no ids are given. */
  closeTests(electronIds?: number[]): Promise<ScreensState>
  onTestInfo(callback: (info: TestInfo) => void): () => void
  addGroup(name: string): Promise<void>
  removeGroup(groupId: string): Promise<void>
  updateGroup(groupId: string, change: Partial<Pick<GroupConfig, 'name' | 'idle' | 'idleInterval' | 'stageView'>>): Promise<void>
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
  /** Show a folder dialog and add the folder as one searchable item (for example the hymnal). */
  pickFolder(): Promise<void>
  /** Search the files of a folder item: a number, a title, or words in the lyrics. */
  searchFolder(itemId: string, query: string): Promise<FolderEntry[]>
  /** Choose the file of a folder item that goes live. */
  chooseInFolder(itemId: string, path: string): Promise<void>
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
  updateItem(
    itemId: string,
    change: { title?: string; notes?: string; settings?: Partial<ItemSettings>; width?: number; height?: number; stanzas?: string[] }
  ): Promise<void>
  /** Add a song or text item that is typed in the app (not from a file). Returns its id. */
  newTextItem(): Promise<string>
  /** Show a file dialog and choose a background picture or video for one song or Bible item. */
  pickItemBackground(itemId: string): Promise<void>
  /** Undo the last change to the order (add, remove, move, copy). */
  undo(): Promise<void>

  // Text styles
  setTextStyle(kind: TextStyleKind, change: Partial<Omit<TextStyle, 'backgroundMedia'>>): Promise<void>
  /** Show a file dialog and choose the background picture or video of a text style. */
  pickTextBackground(kind: TextStyleKind): Promise<void>
  resetTextStyle(kind: TextStyleKind): Promise<void>

  // Shared folder
  getShared(): Promise<SharedState>
  onSharedChanged(callback: (state: SharedState) => void): () => void
  /** Show a folder dialog and watch the chosen folder. */
  pickSharedFolder(): Promise<void>
  /** Watch this folder (a network path like \\PC\Share works), or stop watching (null). */
  setSharedFolder(path: string | null): Promise<void>
  /** Add files to the order. A folder path adds all files directly in it ("All"). */
  addSharedToOrder(paths: string[]): Promise<void>
  /** Remove the "new" mark. No list: all files. */
  markSharedSeen(paths?: string[]): Promise<void>

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

  // Services
  newService(): Promise<void>
  openService(serviceId: string): Promise<void>
  renameService(name: string): Promise<void>
  /** The items of another service (to look at before copying). */
  serviceItems(serviceId: string): Promise<ServiceItem[]>
  /** Copy the order of a past service to the end of this service. */
  copyOrderFrom(serviceId: string): Promise<void>

  // Library, favorites, hotkeys
  pickLibraryFolder(): Promise<void>
  removeLibraryFolder(path: string): Promise<void>
  listLibrary(path: string): Promise<LibEntry[]>
  /** Files whose name has all the words, in a folder and its subfolders. */
  searchLibrary(path: string, query: string): Promise<LibEntry[]>
  addFavorite(path: string): Promise<void>
  addFavoriteAction(kind: 'logo' | 'black' | 'countdown'): Promise<void>
  removeFavorite(id: string): Promise<void>
  /** Give a favorite a hotkey (1–8 = F1–F8), or remove it (null). */
  setHotkey(favoriteId: string, key: number | null): Promise<void>
  /** One press: the favorite goes live now on the target. */
  triggerHotkey(key: number): Promise<void>

  // Stage and messages
  stageTimerSet(label: string, seconds: number): Promise<void>
  stageTimerStart(): Promise<void>
  stageTimerPause(): Promise<void>
  stageTimerReset(): Promise<void>
  /** A message only for the Stage screens (null: remove it). */
  stageMessage(text: string | null): Promise<void>
  /** A lower-third message on a group (or all screens). */
  showMessage(line1: string, line2: string, target: Target): Promise<void>
  saveMessage(line1: string, line2: string): Promise<void>
  deleteMessage(id: string): Promise<void>
  /** Add a countdown item to the order (5:00). */
  addCountdown(): Promise<void>

  // Bible
  /** Show a file dialog and import a Bible file. Returns an error text, or null. */
  importBible(): Promise<string | null>
  /** Import a Bible file dropped on the Bible panel. Returns an error text, or null. */
  importBibleFrom(path: string): Promise<string | null>
  removeBible(bibleId: string): Promise<void>
  /** The online list of versions to download (saved for one day; `refresh` asks the server again). */
  bibleCatalog(refresh?: boolean): Promise<{ entries: BibleCatalogEntry[]; error?: string }>
  /** Download a version from the catalog and add it. Returns an error text, or null. */
  downloadBible(catalogId: string): Promise<string | null>
  onBibleDownload(callback: (p: { id: string; fraction: number }) => void): () => void
  getChapter(bibleId: string, book: number, chapter: number): Promise<string[]>
  searchBible(bibleId: string, query: string): Promise<BibleSearchResult>
  addBibleToOrder(ref: BibleRef): Promise<void>
  /** Show the passage now on the target, without adding it to the order. Starts at verse `startVerse`. */
  showBibleNow(ref: BibleRef, startVerse?: number): Promise<void>
  /** Bible text live in the target: show the screen of this verse. */
  showVerse(verse: number): Promise<void>
  /** Screens for a passage with the given settings (for the preview). */
  bibleScreens(ref: BibleRef, settings: Partial<ItemSettings>): Promise<BibleScreen[]>

  // Audio
  getAudio(): Promise<AudioState>
  onAudioChanged(callback: (state: AudioState) => void): () => void
  updateAudio(change: Partial<Omit<AudioSettings, 'playlist'>>): Promise<void>
  /** Show a file dialog; add music files (or a folder) to the playlist. */
  pickMusic(folder: boolean): Promise<void>
  /** Add music files or folders dropped on the playlist. */
  addMusic(paths: string[]): Promise<void>
  clearPlaylist(): Promise<void>
  musicPlay(index?: number): Promise<void>
  musicPause(): Promise<void>
  musicNext(): Promise<void>
  musicPrevious(): Promise<void>
  musicFadeOut(): Promise<void>
  /** Stop the audio item ("Audio ✕"). */
  stopItemAudio(): Promise<void>

  // Hidden audio window
  onAudioRender(callback: (render: AudioRender) => void): () => void
  audioReport(report: {
    musicTake?: number
    musicTime?: number
    musicDuration?: number
    musicEnded?: boolean
    itemTake?: number
    itemTime?: number
    itemDuration?: number
    itemEnded?: boolean
  }): void
  /** Output level from a player window, 0..1 left and right. */
  audioLevels(source: string, l: number, r: number): void

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
