import type { EndAction, IdleKind, ImageFit, ItemType, ServiceItem } from '../../shared/types'

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
  types: { video: 'Video', image: 'Image', slides: 'Slides', bible: 'Bible', song: 'Song', folder: 'Folder' } as Record<ItemType, string>,
  stanzaCount: (n: number) => (n === 1 ? '1 stanza' : `${n} stanzas`),
  fileCount: (n: number) => `${n} files`,
  indexing: (fraction: number) => `indexing ${Math.round(fraction * 100)}%`,
  addFolder: 'Add folder',
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
    'No Bible version yet. Import a Bible file (or drop it here): Zefania XML, OSIS XML, JSON, or a text file with book, chapter, verse and text. Use only public-domain versions (for example RV1909) or versions the church has a license for.',
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
  songTitle: 'Song title on screen',
  licenseNote: 'For bilingual services. Each version needs its own license, or must be public domain.',

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

export function formatTime(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '--:--'
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
