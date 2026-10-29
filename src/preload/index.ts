import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { MediaConsoleApi, OutputRender, ScreensState, ServiceState, TestInfo } from '../shared/types'

function listen<T>(channel: string, callback: (value: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, value: T): void => callback(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: MediaConsoleApi = {
  // Screens
  getScreens: () => ipcRenderer.invoke('screens:get'),
  onScreensChanged: (cb) => listen<ScreensState>('screens:changed', cb),
  saveOutput: (displayKey, name) => ipcRenderer.invoke('outputs:save', displayKey, name),
  removeOutput: (outputId) => ipcRenderer.invoke('outputs:remove', outputId),
  openTest: (electronIds) => ipcRenderer.invoke('test:open', electronIds),
  closeTests: () => ipcRenderer.invoke('test:close'),
  onTestInfo: (cb) => listen<TestInfo>('test:info', cb),

  // Service order
  getService: () => ipcRenderer.invoke('service:get'),
  onServiceChanged: (cb) => listen<ServiceState>('service:changed', cb),
  pickFiles: () => ipcRenderer.invoke('service:pickFiles'),
  addFiles: (paths) => ipcRenderer.invoke('service:addFiles', paths),
  pathForFile: (file) => webUtils.getPathForFile(file),
  removeItem: (id) => ipcRenderer.invoke('service:removeItem', id),
  retryCopy: (id) => ipcRenderer.invoke('service:retryCopy', id),
  setDuration: (id, seconds) => ipcRenderer.invoke('service:setDuration', id, seconds),
  moveItem: (id, toIndex) => ipcRenderer.invoke('service:moveItem', id, toIndex),
  setItemStatus: (id, status) => ipcRenderer.invoke('service:setItemStatus', id, status),
  goLive: (id) => ipcRenderer.invoke('live:go', id),
  next: () => ipcRenderer.invoke('live:next'),
  previous: () => ipcRenderer.invoke('live:previous'),
  clear: () => ipcRenderer.invoke('live:clear'),
  setPlaying: (playing) => ipcRenderer.invoke('live:setPlaying', playing),
  seek: (seconds) => ipcRenderer.invoke('live:seek', seconds),

  // Output windows
  onOutputRender: (cb) => listen<OutputRender>('output:render', cb),
  reportPlayback: (info) => ipcRenderer.send('output:playback', info)
}

contextBridge.exposeInMainWorld('mediaConsole', api)
