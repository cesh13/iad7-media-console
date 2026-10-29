import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { MediaConsoleApi, OutputRender, PdfJob, ScreensState, ServiceState, TestInfo } from '../shared/types'

function listen<T>(channel: string, callback: (value: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, value: T): void => callback(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const invoke = ipcRenderer.invoke.bind(ipcRenderer)

const api: MediaConsoleApi = {
  // Screens and groups
  getScreens: () => invoke('screens:get'),
  onScreensChanged: (cb) => listen<ScreensState>('screens:changed', cb),
  saveOutput: (displayKey, name) => invoke('outputs:save', displayKey, name),
  removeOutput: (outputId) => invoke('outputs:remove', outputId),
  openTest: (electronIds) => invoke('test:open', electronIds),
  closeTests: () => invoke('test:close'),
  onTestInfo: (cb) => listen<TestInfo>('test:info', cb),
  addGroup: (name) => invoke('groups:add', name),
  removeGroup: (id) => invoke('groups:remove', id),
  updateGroup: (id, change) => invoke('groups:update', id, change),
  assignOutput: (outputId, groupId) => invoke('groups:assign', outputId, groupId),
  pickIdleMedia: (id) => invoke('groups:pickIdle', id),
  clearIdleMedia: (id) => invoke('groups:clearIdle', id),
  pickLogo: () => invoke('groups:pickLogo'),

  // Service order
  getService: () => invoke('service:get'),
  onServiceChanged: (cb) => listen<ServiceState>('service:changed', cb),
  pickFiles: () => invoke('service:pickFiles'),
  addFiles: (paths) => invoke('service:addFiles', paths),
  pathForFile: (file) => webUtils.getPathForFile(file),
  removeItem: (id) => invoke('service:removeItem', id),
  retryCopy: (id) => invoke('service:retryCopy', id),
  setDuration: (id, seconds) => invoke('service:setDuration', id, seconds),
  moveItem: (id, toIndex) => invoke('service:moveItem', id, toIndex),
  setItemStatus: (id, status) => invoke('service:setItemStatus', id, status),
  updateItem: (id, change) => invoke('service:updateItem', id, change),

  // Live
  setTarget: (target) => invoke('live:target', target),
  goLive: (id, target, page) => invoke('live:go', id, target, page),
  pageStep: (delta) => invoke('live:pageStep', delta),
  showPage: (id, page) => invoke('live:showPage', id, page),
  next: () => invoke('live:next'),
  previous: () => invoke('live:previous'),
  clear: (groupId) => invoke('live:clear', groupId),
  setPlaying: (take, playing) => invoke('live:setPlaying', take, playing),
  seek: (take, seconds) => invoke('live:seek', take, seconds),
  setOverlay: (name, on) => invoke('live:overlay', name, on),
  clearText: (groupId) => invoke('live:clearText', groupId),

  // Bible
  importBible: () => invoke('bible:import'),
  importBibleFrom: (path) => invoke('bible:importFrom', path),
  removeBible: (id) => invoke('bible:remove', id),
  getChapter: (id, book, chapter) => invoke('bible:chapter', id, book, chapter),
  searchBible: (id, query) => invoke('bible:search', id, query),
  addBibleToOrder: (ref) => invoke('bible:addToOrder', ref),
  showBibleNow: (ref, startVerse) => invoke('bible:showNow', ref, startVerse),
  showVerse: (verse) => invoke('bible:showVerse', verse),
  bibleScreens: (ref, settings) => invoke('bible:screens', ref, settings),

  // Output windows
  onOutputRender: (cb) => listen<OutputRender>('output:render', cb),
  reportPlayback: (info) => ipcRenderer.send('output:playback', info),

  // Hidden PDF window
  onPdfJob: (cb) => listen<PdfJob>('pdf:job', cb),
  pdfPage: (id, index, count, png, text) => ipcRenderer.send('pdf:page', id, index, count, png, text),
  pdfDone: (id, error) => ipcRenderer.send('pdf:done', id, error),
  pdfReady: () => ipcRenderer.send('pdf:ready')
}

contextBridge.exposeInMainWorld('mediaConsole', api)
