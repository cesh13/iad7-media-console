import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { MediaConsoleApi, OutputRender, ScreensState, ServiceState, TestInfo } from '../shared/types'

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

  // Live
  setTarget: (target) => invoke('live:target', target),
  goLive: (id) => invoke('live:go', id),
  next: () => invoke('live:next'),
  previous: () => invoke('live:previous'),
  clear: (groupId) => invoke('live:clear', groupId),
  setPlaying: (take, playing) => invoke('live:setPlaying', take, playing),
  seek: (take, seconds) => invoke('live:seek', take, seconds),
  setOverlay: (name, on) => invoke('live:overlay', name, on),

  // Output windows
  onOutputRender: (cb) => listen<OutputRender>('output:render', cb),
  reportPlayback: (info) => ipcRenderer.send('output:playback', info)
}

contextBridge.exposeInMainWorld('mediaConsole', api)
