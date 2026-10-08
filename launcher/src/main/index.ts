import { app, BrowserWindow, dialog, ipcMain, shell, type WebContents } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import { checkJava, exportMod, requiredJava, stopBuild } from './exporter'
import { commit, createProject, history, listFiles, readProject, restore, writeProject } from './projects'
import { dataUrl, importInto, pngInfo } from './assets'
import { loadSettings, rememberProject, saveSettings } from './settings'
import { searchModrinth } from './modrinth'
import { addModrinthMod, copyModFile, downloadMinecraft, importAssets, listAssets, listSources, minecraftInfo, thumbnails } from './gameAssets'
import { ProjectSchema } from '../shared/schema'
import type { ExportRequest, ModrinthQuery, OpenedProject } from '../shared/ipc'

function createWindow(hash = '', opts: Electron.BrowserWindowConstructorOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 980,
    minHeight: 600,
    backgroundColor: '#0e0e10',
    title: 'NKW Custom Skin',
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(app.getAppPath(), 'build', 'icon.png'),
    ...opts,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'] + hash)
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: hash.replace('#', '') })
  return win
}

let modWin: BrowserWindow | null = null
function openModBrowser(): void {
  if (modWin && !modWin.isDestroyed()) return modWin.focus()
  modWin = createWindow('#modrinth', { width: 980, height: 820, minWidth: 640, minHeight: 480, title: 'Mod browser (Modrinth)' })
  modWin.on('closed', () => (modWin = null))
}

/** The project the user is working in; the separate mod browser window adds mods to it. */
let activeProject: string | null = null

function broadcastProgress(p: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) safeSend(w.webContents, 'assets:progress', p)
}

function opened(dir: string): OpenedProject {
  const project = readProject(dir)
  activeProject = path.resolve(dir)
  rememberProject({ dir, name: project.meta.name, modId: project.meta.modId })
  return { dir, project }
}

/** Only folders the user picked (or that are in the recent list) may be used as project folders. */
const known = new Set<string>()
/** Export folders the user picked in a dialog (plus the last one); the renderer cannot name any other. */
const exportFolders = new Set<string>()
const allow = (dir: string): string => {
  const abs = path.resolve(dir)
  if (!known.has(abs)) throw new Error('Unknown project folder')
  return abs
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => {
    const s = loadSettings()
    s.recent.forEach((r) => known.add(path.resolve(r.dir)))
    if (s.lastExportDir) exportFolders.add(path.resolve(s.lastExportDir))
    return s
  })
  ipcMain.handle('settings:lang', (_e, lang: 'en' | 'th') => {
    const s = loadSettings()
    s.lang = lang === 'en' ? 'en' : 'th'
    saveSettings(s)
  })
  ipcMain.handle('settings:forget', (_e, dir: string) => {
    const s = loadSettings()
    s.recent = s.recent.filter((r) => r.dir !== dir)
    saveSettings(s)
    return s
  })

  ipcMain.handle('project:create', async (_e, name: string) => {
    const r = await dialog.showOpenDialog({ title: 'Choose where to create the project', properties: ['openDirectory', 'createDirectory'] })
    if (r.canceled || !r.filePaths[0]) return null
    const made = await createProject(r.filePaths[0], String(name).slice(0, 64))
    known.add(path.resolve(made.dir))
    return opened(made.dir)
  })
  ipcMain.handle('project:open', async () => {
    const r = await dialog.showOpenDialog({ title: 'Open project folder', properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return null
    known.add(path.resolve(r.filePaths[0]))
    return opened(r.filePaths[0])
  })
  ipcMain.handle('project:openRecent', (_e, dir: string) => {
    return opened(allow(dir))
  })
  ipcMain.handle('project:save', (_e, dir: string, project: unknown) => {
    writeProject(allow(dir), ProjectSchema.parse(project))
  })
  ipcMain.handle('project:chooseLogo', async (_e, dir: string) => {
    const root = allow(dir)
    const r = await dialog.showOpenDialog({ title: 'Choose logo', properties: ['openFile'], filters: [{ name: 'PNG', extensions: ['png'] }] })
    if (r.canceled || !r.filePaths[0]) return null
    fs.copyFileSync(r.filePaths[0], path.join(root, 'logo.png'))
    return 'logo.png'
  })

  ipcMain.handle('files:list', (_e, dir: string) => listFiles(allow(dir)))
  ipcMain.handle('files:import', async (_e, dir: string, sub: 'models' | 'textures', paths?: string[]) => {
    const root = allow(dir)
    let files = paths
    if (!files) {
      const r = await dialog.showOpenDialog({ title: `Import ${sub}`, properties: ['openFile', 'multiSelections'], filters: sub === 'textures' ? [{ name: 'PNG', extensions: ['png'] }] : [] })
      if (r.canceled) return []
      files = r.filePaths
    }
    return importInto(root, sub, files)
  })
  ipcMain.handle('asset:info', (_e, dir: string, rel: string) => pngInfo(allow(dir), rel))
  ipcMain.handle('asset:dataUrl', (_e, dir: string, rel: string) => dataUrl(allow(dir), rel))

  ipcMain.handle('git:log', (_e, dir: string) => history(allow(dir)))
  ipcMain.handle('git:commit', (_e, dir: string, msg: string) => commit(allow(dir), String(msg || 'Update').slice(0, 200)))
  ipcMain.handle('git:restore', (_e, dir: string, hash: string) => restore(allow(dir), hash))

  ipcMain.handle('dir:choose', async () => {
    const r = await dialog.showOpenDialog({ title: 'Choose export folder', properties: ['openDirectory', 'createDirectory'] })
    const dir = r.canceled ? null : (r.filePaths[0] ?? null)
    if (dir) exportFolders.add(path.resolve(dir))
    return dir
  })
  ipcMain.handle('java:check', (_e, mc?: string) => checkJava(requiredJava(typeof mc === 'string' ? mc : '1.21.1')))
  ipcMain.handle('build:start', async (e: Electron.IpcMainInvokeEvent, req: ExportRequest) => {
    const send = (line: string): void => safeSend(e.sender, 'build:log', line)
    const dir = allow(req.projectDir)
    if (req.task !== 'build' && req.task !== 'runClient') throw new Error('bad task')
    if (req.task === 'build' && !exportFolders.has(path.resolve(String(req.outDir)))) throw new Error('Choose the export folder with the Folder button')
    const res = await exportMod(dir, req.outDir, req.task, send, { figura: req.testMods?.figura === true, plasmo: req.testMods?.plasmo === true })
    if (res.ok && req.outDir) {
      const s = loadSettings()
      s.lastExportDir = req.outDir
      saveSettings(s)
    }
    return res
  })
  ipcMain.handle('build:stop', () => stopBuild())
  ipcMain.handle('shell:openFolder', (_e, p: string) => {
    // folders are opened, files are only revealed: a path from the renderer must never launch a program
    if (typeof p !== 'string' || !path.isAbsolute(p) || !fs.existsSync(p)) return
    if (fs.statSync(p).isDirectory()) void shell.openPath(p)
    else shell.showItemInFolder(p)
  })

  ipcMain.handle('assets:sources', (_e, dir: string, mc: string) => listSources(allow(dir), String(mc)))
  ipcMain.handle('assets:mcInfo', (_e, mc: string) => minecraftInfo(String(mc)))
  ipcMain.handle('assets:mcDownload', (_e, mc: string) => downloadMinecraft(String(mc), broadcastProgress))
  ipcMain.handle('assets:addModFile', async (_e, dir: string) => {
    const root = allow(dir)
    const r = await dialog.showOpenDialog({ title: 'Choose a mod (.jar)', properties: ['openFile'], filters: [{ name: 'Mod', extensions: ['jar'] }] })
    return r.canceled || !r.filePaths[0] ? null : copyModFile(root, r.filePaths[0])
  })
  ipcMain.handle('assets:addModrinth', async (_e, slug: string) => {
    if (!activeProject) throw new Error('Open a project first')
    const project = readProject(activeProject)
    return addModrinthMod(activeProject, String(slug), project.meta.mcVersion, project.meta.loader, broadcastProgress)
  })
  ipcMain.handle('assets:list', (_e, dir: string, id: string) => listAssets(allow(dir), String(id)))
  ipcMain.handle('assets:thumbs', (_e, dir: string, id: string, paths: string[]) => thumbnails(allow(dir), String(id), Array.isArray(paths) ? paths.map(String) : []))
  ipcMain.handle('assets:import', (_e, dir: string, id: string, paths: string[]) => importAssets(allow(dir), String(id), Array.isArray(paths) ? paths.map(String) : []))

  ipcMain.handle('modrinth:search', (_e, q: ModrinthQuery) => searchModrinth(q))
  ipcMain.handle('modrinth:openWindow', () => openModBrowser())
}

function safeSend(wc: WebContents, channel: string, payload: unknown): void {
  if (!wc.isDestroyed()) wc.send(channel, payload)
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
