import type { EndAction, IdleKind, ImageFit, ItemType, ServiceItem, TextBackground, TextStyleKind, UndoKind } from '../../shared/types'

// All UI text lives here, so it can be translated later.

export const strings = {
  appName: 'Media Console',
  tabService: 'Service',
  tabScreens: 'Screens',

  // Screens page
  screensHelp:
    'Give a name to each screen that shows output (for example "Projector"). The control monitor does not need a name. Named screens show the live item.',
  layoutLabel: 'Screen layout',
  detectedLabel: 'Detected screens',
  missingLabel: 'Saved screens not found',
  missingHelp: 'These screens are saved but not connected now. Check the cable and the Windows display settings.',
  testAll: 'Test all screens',
  closeTests: 'Close test windows',
  test: 'Test',
  testOpen: 'Test open',
  save: 'Save',
  remove: 'Remove',
  namePlaceholder: 'Output name, e.g. Projector',
  notOutput: 'Not an output',
  primary: 'Primary',
  scale: (f: number) => `scale ${Math.round(f * 100)}%`,
  position: (x: number, y: number) => `at ${x}, ${y}`,
  savedKey: (key: string) => `Saved as: ${key}`,
  noScreens: 'No screens found.',
  testEscHint: 'Press Esc to close this test window',
  testUnnamed: 'No output name',
  windowSize: (w: number, h: number) => `window ${w}×${h}`,

  // Order panel
  orderLabel: 'Order',
  addFiles: 'Add files',
  progress: (done: number, total: number) => `${done} of ${total} done`,
  emptyOrder: 'Drop videos, pictures, PDF or PowerPoint files here, or use Add files. Files are added in file-name order.',
  dropHere: 'Drop to add to the order',
  skippedFiles: (names: string[]) => `Not added (type not supported): ${names.join(', ')}`,
  badgeLive: 'LIVE',
  badgeNext: 'NEXT',
  copying: (fraction: number) => `copying ${Math.round(fraction * 100)}%`,
  copyError: 'error',
  typeVideo: 'Video',
  typeImage: 'Image',
  types: { video: 'Video', image: 'Image', slides: 'Slides', bible: 'Bible', song: 'Song', folder: 'Folder', audio: 'Audio', countdown: 'Countdown' } as Record<ItemType, string>,
  stanzaCount: (n: number) => (n === 1 ? '1 stanza' : `${n} stanzas`),
  fileCount: (n: number) => `${n} files`,
  indexing: (fraction: number) => `indexing ${Math.round(fraction * 100)}%`,
  addFolder: 'Add folder',

  // Top bar: services
  serviceLabel: 'Service',
  renameHint: 'Double-click to rename',
  renameService: 'Rename this service',
  newService: 'New',
  elapsedHint: 'Time since the first item went live',

  // Hotkeys
  hotkeysLabel: 'Hotkeys',
  emptyHotkey: '[empty]',

  // Library (SPEC 5.2)
  libraryLabel: 'Library',
  libraryFolders: 'Library folders',
  favorites: 'Favorites',
  removeLibraryFolder: 'Remove from the library (the files stay)',
  addLibraryFolder: 'Add library folder',
  pastServices: 'Past services',
  noPastServices: 'No past services yet.',
  itemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  libraryHelp: 'Choose a library folder, ★ Favorites, or a past service.',
  searchLibrary: 'Search library',
  libFilters: { All: 'All', Video: 'Video', Slides: 'Slides', Songs: 'Songs', Images: 'Images', Audio: 'Audio' } as Record<string, string>,
  sortLabel: 'Sort',
  sortName: 'Name',
  sortUsed: 'Last used',
  sortAdded: 'Date added',
  addAllToOrder: 'Add all to order',
  libEmpty: 'No files here.',
  dirHint: (n: number) => `${n} files · double-click to open`,
  usedText: (u?: { count: number; last: number }) => {
    if (!u) return 'Never used'
    if (u.count > 2) return `Used ${u.count} times`
    return `Used ${new Date(u.last).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`
  },
  libTip: 'Double-click or Enter adds a file to the order. You can also drag a file to the Order tab.',
  libSelectHint: 'Select a file to see its details.',
  typeLabel: 'Type',
  sizeLabel: 'Size',
  addedLabel: 'Added',
  lastUsedLabel: 'Last used',
  openInPreview: 'Open in preview',
  addToFavorites: 'Add to Favorites',
  inFavorites: 'In Favorites',
  favoritesHelp: 'One press of a hotkey = live now on the target.',
  addAction: 'Add',
  blackShort: 'Black screen',
  countdown5: 'Countdown 5 min',
  noHotkey: 'No hotkey',
  reuseHelp: (name: string) => `Reuse "${name}": copy its order to this service, then change only what is new. Folder items keep the folder; choose the file again.`,
  folderKept: 'folder: choose the file again',
  copyOrder: 'Copy order to this service',
  openThisService: 'Open this service',

  // Shared folder
  sharedLabel: 'Shared folder',
  sharedHelp:
    'Watch a network folder (for example \\\\MEDIA-PC\\Compartida). New files are copied and converted at once, so they are ready for the service.',
  sharedPathPlaceholder: '\\\\MEDIA-PC\\Compartida',
  watch: 'Watch',
  chooseFolder: 'Choose…',
  watching: 'Watching',
  unreachable: 'Not reachable',
  stopWatching: 'Stop watching this folder',
  markSeen: 'Seen',
  newCount: (n: number) => `${n} NEW`,
  all: 'All',
  allHint: 'Add all files of this folder to the order, in file-name order',
  sharedDirState: (files: number, ready: boolean) => ` ${files} files · ${ready ? 'all ready' : 'copying… wait'}`,
  sharedEmpty: 'The folder is empty.',
  sharedRetry: 'Trying again every 15 seconds…',
  inOrder: 'in order ✓',
  ready: 'ready',
  waiting: 'waiting',
  prepareStates: { copying: 'copying', converting: 'converting', rendering: 'making pages' } as Record<string, string>,
  ago: (ms: number) => {
    const min = Math.round(ms / 60000)
    if (min < 1) return 'now'
    if (min < 60) return `${min} min ago`
    const h = Math.round(min / 60)
    return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
  },
  addFolderHint: 'Add a folder as one item with search (for example the hymnal)',
  folderSearchPlaceholder: 'Number, title or words of the song',
  folderNoResults: 'No files found.',
  folderChooseHint: 'Choose a file in the folder: select the folder row in the order and search.',
  fromFolder: (name: string) => `from folder ${name}`,
  verseCount: (n: number) => (n === 1 ? '1 verse' : `${n} verses`),
  slideCount: (n: number) => (n === 1 ? '1 slide' : `${n} slides`),
  cacheStates: (item: ServiceItem): string => {
    const pct = Math.round((item.cacheProgress ?? 0) * 100)
    if (item.cache === 'copying') return `copying ${pct}%`
    if (item.cache === 'converting') return 'converting to PDF…'
    if (item.cache === 'rendering') return `making pages ${pct}%`
    if (item.cache === 'error') return 'error'
    return ''
  },

  // Selected item
  selectedLabel: 'Selected',
  noSelection: 'Select an item in the order.',
  goLive: 'Go live',
  markDone: 'Mark done',
  markPending: 'Mark not done',
  retryCopy: 'Copy again',
  source: 'Source',
  cachedCopy: 'Local copy',
  notReady: 'The file is still copying. It can go live when the copy is ready.',

  // Preview panel
  previewLabel: 'Preview',
  previewMuted: 'preview is muted',
  localCopyOk: 'local copy ✓',
  notes: 'Item notes',
  notesPlaceholder: 'Notes for the team (shown on the Stage screen later)',
  autoDone: 'Auto-mark done at end',
  points: 'Start / end',
  startPoint: 'Start point',
  endPoint: 'End point',
  setStart: 'Set start',
  setEnd: 'Set end',
  clearPoints: 'Clear points',
  cues: 'Cues',
  cuePlaceholder: 'Cue name, e.g. pausa para oración',
  addCue: 'Add cue at',
  jumpPreview: 'Jump',
  jumpLive: 'Jump live',
  volume: 'Volume',
  fade: 'Fade in / out 1 s',
  whenEnds: 'When it ends',
  endActions: { next: 'Go to next item', idle: 'Go to idle screen', black: 'Black screen', hold: 'Hold last frame', loop: 'Loop' } as Record<EndAction, string>,
  fitLabel: 'Fit',
  fits: { fit: 'Fit', fill: 'Fill (crop)', blur: 'Blur sides' } as Record<ImageFit, string>,
  verticalNote: 'The picture is vertical, so "Fit" adds black bars at the sides.',
  autoNextLabel: 'Auto-advance',
  autoNextAfter: 'Next item after',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  pageOf: (n: number, total: number) => `page ${n} of ${total}`,
  slidesHelp: 'Click a page to preview it. Double-click: show it live. ← → keys change the live page.',
  autoAdvanceEvery: 'Next page every',
  loopSlides: 'Loop (after the last page, start again)',

  // Bible panel
  bibleLabel: 'Bible',
  noBible:
    'No Bible version yet. Download a free version (for example Reina Valera 1909), or import a Bible file (or drop it here): Zefania XML, OSIS XML, JSON, or a text file with book, chapter, verse and text.',
  downloadVersion: 'Download a version…',
  downloadShort: 'Download…',
  downloadVersionHint: 'Download more Bible versions from the free online catalog',
  downloadVersions: 'Download Bible versions',
  catalogHelp:
    'Free versions from the getbible.net catalog (texts from the CrossWire Bible Society). After the download, the version works without internet. Versions like RVR1960, NVI or NTV are not here: they need a license; import those from a file.',
  catalogSearch: 'Search by name, for example "Reina Valera"',
  allLanguages: 'All languages',
  refreshCatalog: 'Get the list again from the internet',
  catalogLoading: 'Loading the list of versions…',
  catalogNone: 'No versions found.',
  catalogOffline: (err: string) => `The list could not be loaded. Check the internet connection. (${err})`,
  catalogOldList: (err: string) => `No internet: this is the list from the last time. (${err})`,
  download: 'Download',
  downloading: 'downloading…',
  installed: 'Installed ✓',
  versionsOnThisComputer: 'Versions on this computer',
  licenseReminder:
    'The license of each version is shown in the list. "Copyrighted; permission to distribute granted to CrossWire" means the owner allows CrossWire to share it; check that showing it in church is allowed.',
  importBible: 'Import a Bible file…',
  importShort: 'Import…',
  importBibleHint: 'Import another Bible version from a file',
  bibleSearchPlaceholder: 'jn 3 16 · sal 23:1-4 · buen pastor',
  addToOrder: 'Add to order',
  showNow: 'Show now',
  prevChapter: 'Previous chapter',
  nextChapter: 'Next chapter',
  crumbBooks: 'Libros',
  today: 'Today',
  stepBook: 'Libro',
  stepChapter: 'Capítulo',
  stepVerse: 'Versículo',
  oldTestament: 'Antiguo Testamento',
  newTestament: 'Nuevo Testamento',
  pickChapter: (book: string, count: number) => `${book} · pick a chapter (${count})`,
  pickVerse: (book: string, chapter: number) => `${book} ${chapter} · pick a verse (Shift+click = range)`,
  pickerHelp: 'Type a number to jump (for example "23"). Double-click a verse: show it now.',
  versesOf: (book: string, chapter: number) => `Verses · ${book} ${chapter}`,
  searchResults: (n: number, more: boolean) => (n === 0 ? 'No verses found' : `${n}${more ? '+' : ''} verses found`),

  // Bible preview
  bibleMissing: 'version not found',
  versesToScreens: (verses: number, screens: number) => `${verses} verses → ${screens} screens`,
  splitNote: 'This verse is long, so it is split into more screens. "…" shows that it continues.',
  versesPerScreen: 'Verses per screen',
  fitMany: 'Fit as many',
  splitLong: 'Split long verses',
  reference: 'Reference',
  refPositions: { below: 'Below text', above: 'Above text', hide: 'Hide' } as Record<'below' | 'above' | 'hide', string>,
  showVersion: 'Show version name',
  mode: 'Mode',
  modeFull: 'Full screen',
  modeLower: 'Lower third (over video)',
  secondVersion: 'Second version',
  none: 'None',
  songTitle: 'Title on screen',

  // Typed text (songs, announcements)
  addText: 'Text',
  addTextHint: 'Type a song, a chorus or an announcement',
  noTextYet: 'no text yet',
  editText: 'Edit text',
  saveText: 'Save text',
  cancel: 'Cancel',
  songTextPlaceholder:
    'Type the text here.\n\nAn empty line starts a new screen.\nA line break stays a line break on the screen.',
  songTextHelp: 'An empty line starts a new screen. Ctrl+Enter saves.',
  songFileEditNote: 'This changes the text only in this service, not in the file. An empty line starts a new screen.',
  itemBackground: 'Background for this item',
  useStyleBackground: 'Same as the text style',
  chooseFile: 'Choose…',
  textStyleButton: 'Text style…',

  // Undo
  undo: 'Undo',
  undoHint: (kind: UndoKind) => `Undo: ${undoKinds[kind]} (Ctrl+Z)`,
  nothingToUndo: 'Nothing to undo',

  // Text style window
  textStyleTitle: 'Text style',
  styleKinds: { bible: 'Bible', song: 'Songs and text' } as Record<TextStyleKind, string>,
  styleKindHelp: {
    bible: 'For Bible passages and lower-third messages.',
    song: 'For songs, hymns (.txt) and typed text such as announcements.'
  } as Record<TextStyleKind, string>,
  styleSamples: {
    bible: {
      text: 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito.',
      ref: 'Juan 3:16 · RV1909'
    },
    song: { text: '¡Santo! ¡Santo! ¡Santo!\nSeñor omnipotente,\nsiempre el labio mío\nloores te dará.', ref: 'Santo, Santo, Santo' }
  } as Record<TextStyleKind, { text: string; ref: string }>,
  styleFont: 'Font',
  styleFonts: { serif: 'Serif (book)', sans: 'Sans (clean)' } as Record<'serif' | 'sans', string>,
  styleSize: 'Largest text size',
  styleSizeHelp: 'Long text is made smaller, so it always fits on the screen.',
  styleColor: 'Text color',
  styleAlign: 'Text',
  styleAligns: { center: 'Centered', left: 'Left' } as Record<'center' | 'left', string>,
  styleShadow: 'Shadow behind the letters',
  styleUppercase: 'CAPITAL LETTERS',
  styleBackground: 'Background (full screen)',
  styleBackgrounds: { idle: 'Idle background', black: 'Black', color: 'Color', media: 'Picture or video' } as Record<
    TextBackground,
    string
  >,
  styleIdleHelp: 'The picture or video of the group\'s idle screen (Screens › Groups). Black if the group has none.',
  styleDim: 'Darker',
  styleLiveNote: 'Changes are saved and show on the screens at once.',
  styleReset: 'Reset to default',
  done: 'Done',
  licenseNote: 'For bilingual services. Each version needs its own license, or must be public domain.',

  // Stage screen and tabs
  stageNow: 'Now',
  stageNext: 'Next',
  timerLabel: 'Participant countdown',
  timerNamePlaceholder: 'Sermón',
  minutes: 'min',
  setTime: 'Set',
  start: 'Start',
  reset: 'Reset',
  stageMessagesLabel: 'Message only for the Stage screen',
  stageQuick: ['5 min', 'Wrap up', 'Video ready'],
  stageFreePlaceholder: 'Free text for the Stage screen',
  send: 'Send',
  removeMessage: 'Remove message',
  messageNow: (text: string) => `On Stage now: "${text}"`,
  noStageGroup: 'No group has the stage view. Turn it on for the Stage group in Screens › Groups.',
  lowerThirdLabel: 'Text on screen (lower third)',
  line1Placeholder: 'Name, or the notice',
  line2Placeholder: 'Role (optional)',
  showOn: (target: string) => `Show on ${target}`,
  saveMessage: 'Save',
  savedMessages: 'Saved messages',
  noSavedMessages: 'No saved messages yet.',
  stageViewLabel: 'Stage view',
  stageViewHelp: 'Clock, countdown, now, next, notes and messages for the people on the platform',

  // Countdown item
  addCountdown: 'Countdown',
  countdownMode: 'Count',
  countdownDuration: 'Duration',
  countdownUntil: 'Until clock time',
  textAbove: 'Text above',
  textAbovePlaceholder: 'El culto inicia en',
  atZero: 'At 0:00',
  atZeroActions: { next: 'Go to next item', logo: 'Show logo', stay: 'Stay at 0:00' } as Record<'next' | 'logo' | 'stay', string>,
  showOnStage: 'Also show on Stage screen',

  // Quick panel and audio
  tabAudio: 'Audio',
  tabMessage: 'Message',
  tabStage: 'Stage',
  noMusic: 'No background music',
  playingBadge: 'PLAYING',
  duckedBadge: 'lower (video)',
  playlistLine: (n: number, total: number, shuffle: boolean) => `Playlist: ${n} of ${total}${shuffle ? ' · shuffle' : ''}`,
  playlistEmpty: 'Add music files or a folder to the playlist.',
  fadeOut3: 'Fade out 3 s',
  playlist: 'Playlist',
  musicFiles: 'Files',
  musicFolder: 'Folder',
  shuffle: 'Shuffle',
  background: 'Background',
  videoItems: 'Video / items',
  outputLevel: 'Output level',
  outputDevice: 'Output device',
  defaultDevice: 'System default',
  mainDevice: 'Main output device',
  autoDuck: 'Lower background music when a video plays (auto duck)',
  startAfterLast: 'Start background music after the last item',
  audioX: 'Audio ✕',
  audioLabel: 'Audio',
  stopMusic: 'Stop background music',
  audioItemNote: 'Audio only: the screens do not change.',

  // Live panel
  liveLabel: 'Live',
  nothingLive: 'Nothing is live. Each group shows its idle screen.',
  sendTo: 'Send to',
  allScreens: 'All screens',
  play: 'Play',
  pause: 'Pause',
  back10: '−10 s',
  forward10: '+10 s',
  previous: 'Previous',
  next: 'Next',
  clear: 'Clear',
  keysHelp: 'Space: next item · ← →: slides · Esc: clear',

  // Screens column
  screensColumn: 'Screens',
  target: 'target',
  idleShort: 'Idle',
  groupNoScreens: 'No screens in this group.',
  newScreens: 'New screens: add them to a group',
  noOutputs: 'No output screens yet. Open the Screens tab and give a name to the projector and the other output screens.',
  connected: 'connected',
  notConnected: 'not connected',
  audioHere: 'sound',

  // Top bar
  logo: 'Logo',
  noLogoHint: 'Choose a logo in Screens › Groups first',
  blackAll: 'Black screen (all)',
  clearText: 'Clear text',
  clearTextShort: 'Clear text',
  textX: 'Text ✕',
  blackOn: 'Black is ON — click to show',

  // Groups editor
  groupsLabel: 'Groups',
  groupsHelp:
    'Screens in the same group show the same content. Put the projector in Main and the participant monitor in Stage. To duplicate a screen, put both screens in one group.',
  logoLabel: 'Church logo',
  noLogo: 'No logo chosen',
  chooseLogo: 'Choose logo',
  notInGroup: 'not in a group',
  addToGroup: 'Add to a group…',
  newGroupPlaceholder: 'New group name, e.g. Lobby',
  addGroup: 'Add group',
  removeGroup: 'Remove group',
  groupScreens: 'Screens',
  noOutputsShort: 'No named screens yet.',
  idleLabel: 'When nothing is live',
  idleKinds: { black: 'Black', logo: 'Logo', background: 'Background', loop: 'Loop' } as Record<IdleKind, string>,
  idleFiles: 'Files',
  chooseFiles: 'Choose files',
  clearFiles: 'Clear',
  idleInterval: 'Seconds per image',
  idleNeedsLogo: 'Choose a church logo above, or the screen stays black.',
  idleNeedsFiles: 'Choose files, or the screen stays black.'
}

const undoKinds: Record<UndoKind, string> = {
  add: 'add to the order',
  remove: 'remove from the order',
  move: 'move in the order',
  copy: 'copy from a past service'
}

export function formatTime(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '--:--'
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
