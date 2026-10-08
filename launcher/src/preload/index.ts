import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api } from '../shared/ipc'

const api: Api = {
  settings: () => ipcRenderer.invoke('settings:get'),
  setLang: (lang) => ipcRenderer.invoke('settings:lang', lang),
  forgetRecent: (dir) => ipcRenderer.invoke('settings:forget', dir),
  createProject: (name) => ipcRenderer.invoke('project:create', name),
  openProject: () => ipcRenderer.invoke('project:open'),
  openRecent: (dir) => ipcRenderer.invoke('project:openRecent', dir),
  saveProject: (dir, project) => ipcRenderer.invoke('project:save', dir, project),
  chooseLogo: (dir) => ipcRenderer.invoke('project:chooseLogo', dir),
  listFiles: (dir) => ipcRenderer.invoke('files:list', dir),
  importFiles: (dir, sub, paths) => ipcRenderer.invoke('files:import', dir, sub, paths),
  assetInfo: (dir, rel) => ipcRenderer.invoke('asset:info', dir, rel),
  assetDataUrl: (dir, rel) => ipcRenderer.invoke('asset:dataUrl', dir, rel),
  gitLog: (dir) => ipcRenderer.invoke('git:log', dir),
  gitCommit: (dir, message) => ipcRenderer.invoke('git:commit', dir, message),
  gitRestore: (dir, hash) => ipcRenderer.invoke('git:restore', dir, hash),
  chooseDir: () => ipcRenderer.invoke('dir:choose'),
  checkJava: (mc) => ipcRenderer.invoke('java:check', mc),
  startBuild: (req) => ipcRenderer.invoke('build:start', req),
  stopBuild: () => ipcRenderer.invoke('build:stop'),
  onBuildLog: (cb) => {
    const fn = (_: unknown, line: string): void => cb(line)
    ipcRenderer.on('build:log', fn)
    return () => ipcRenderer.removeListener('build:log', fn)
  },
  openFolder: (p) => ipcRenderer.invoke('shell:openFolder', p),
  searchModrinth: (q) => ipcRenderer.invoke('modrinth:search', q),
  openModBrowser: () => ipcRenderer.invoke('modrinth:openWindow'),
  assetSources: (dir, mc) => ipcRenderer.invoke('assets:sources', dir, mc),
  minecraftInfo: (mc) => ipcRenderer.invoke('assets:mcInfo', mc),
  downloadMinecraft: (mc) => ipcRenderer.invoke('assets:mcDownload', mc),
  addModFile: (dir) => ipcRenderer.invoke('assets:addModFile', dir),
  addModrinth: (slug) => ipcRenderer.invoke('assets:addModrinth', slug),
  listAssets: (dir, id) => ipcRenderer.invoke('assets:list', dir, id),
  thumbnails: (dir, id, paths) => ipcRenderer.invoke('assets:thumbs', dir, id, paths),
  blockFaces: (dir, id, mc, names) => ipcRenderer.invoke('assets:blockFaces', dir, id, mc, names),
  importAssets: (dir, id, paths) => ipcRenderer.invoke('assets:import', dir, id, paths),
  onDownloadProgress: (cb) => {
    const fn = (_: unknown, p: Parameters<typeof cb>[0]): void => cb(p)
    ipcRenderer.on('assets:progress', fn)
    return () => ipcRenderer.removeListener('assets:progress', fn)
  },
  pathOf: (file) => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('api', api)
