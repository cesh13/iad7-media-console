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
  emptyOrder: 'Drop video or image files here, or use Add files. Files are added in file-name order.',
  dropHere: 'Drop to add to the order',
  skippedFiles: (names: string[]) => `Not added (type not supported): ${names.join(', ')}`,
  badgeLive: 'LIVE',
  badgeNext: 'NEXT',
  copying: (fraction: number) => `copying ${Math.round(fraction * 100)}%`,
  copyError: 'copy failed',
  typeVideo: 'Video',
  typeImage: 'Image',

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

  // Live panel
  liveLabel: (group: string) => `Live on ${group}`,
  nothingLive: 'Nothing is live. The screens are black.',
  play: 'Play',
  pause: 'Pause',
  back10: '−10 s',
  forward10: '+10 s',
  previous: 'Previous',
  next: 'Next',
  clear: 'Clear',
  keysHelp: 'Space: next item · Esc: clear',

  // Group card
  groupLabel: (group: string) => `Group ${group}`,
  noOutputs: 'No output screens yet. Open the Screens tab and give a name to the projector and the other output screens.',
  connected: 'connected',
  notConnected: 'not connected',
  audioHere: 'sound'
}

export function formatTime(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '--:--'
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
