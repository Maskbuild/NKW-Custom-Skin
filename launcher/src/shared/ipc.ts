import type { Project } from './schema'

export interface GitEntry {
  hash: string
  message: string
  date: string
}

export interface FileNode {
  name: string
  path: string
  dir: boolean
  children?: FileNode[]
}

export type BuildTask = 'build' | 'runClient'

export interface ExportRequest {
  projectDir: string
  outDir: string
  task: BuildTask
  /** extra mods for a test run (Mod Menu is always added) */
  testMods?: { figura: boolean; plasmo: boolean }
}

export interface ExportResult {
  ok: boolean
  jar?: string
  error?: string
  cancelled?: boolean
}

export interface RecentProject {
  dir: string
  name: string
  modId: string
}

export interface AppSettings {
  lang: 'en' | 'th'
  recent: RecentProject[]
  lastExportDir?: string
}

export interface OpenedProject {
  dir: string
  project: Project
}

/** API exposed to the renderer through the preload script. */
export interface Api {
  settings(): Promise<AppSettings>
  setLang(lang: 'en' | 'th'): Promise<void>
  forgetRecent(dir: string): Promise<AppSettings>
  createProject(name: string): Promise<OpenedProject | null>
  openProject(): Promise<OpenedProject | null>
  openRecent(dir: string): Promise<OpenedProject>
  saveProject(dir: string, project: Project): Promise<void>
  chooseLogo(dir: string): Promise<string | null>
  listFiles(dir: string): Promise<FileNode[]>
  /** copies files into textures/ or models/ and returns their project-relative paths */
  importFiles(dir: string, sub: 'models' | 'textures', paths?: string[]): Promise<string[]>
  assetInfo(dir: string, rel: string): Promise<{ w: number; h: number } | null>
  assetDataUrl(dir: string, rel: string): Promise<string | null>
  gitLog(dir: string): Promise<GitEntry[]>
  gitCommit(dir: string, message: string): Promise<void>
  gitRestore(dir: string, hash: string): Promise<Project>
  chooseDir(): Promise<string | null>
  checkJava(mc?: string): Promise<{ ok: boolean; version: string; required: number }>
  startBuild(req: ExportRequest): Promise<ExportResult>
  stopBuild(): Promise<void>
  onBuildLog(cb: (line: string) => void): () => void
  openFolder(path: string): Promise<void>
  searchModrinth(q: ModrinthQuery): Promise<ModrinthPage>
  openModBrowser(): Promise<void>
  /** Minecraft and the mods added to the project, as browsable sources of blocks, items, models and textures */
  assetSources(dir: string, mc: string): Promise<AssetSource[]>
  minecraftInfo(mc: string): Promise<{ ready: boolean; sizeMB: number }>
  downloadMinecraft(mc: string): Promise<void>
  addModFile(dir: string): Promise<string | null>
  /** adds a Modrinth mod to the open project (loader and Minecraft version come from the project) */
  addModrinth(slug: string): Promise<string>
  listAssets(dir: string, sourceId: string): Promise<AssetEntry[]>
  thumbnails(dir: string, sourceId: string, paths: string[]): Promise<Record<string, string>>
  /** the top and side textures of blocks (from their block state / model), for a 3D preview and for importing them */
  blockFaces(dir: string, sourceId: string, mc: string, names: string[]): Promise<Record<string, BlockFaces>>
  /** copies jar entries into the project; returns entry -> project path */
  importAssets(dir: string, sourceId: string, paths: string[]): Promise<Record<string, string>>
  onDownloadProgress(cb: (p: DownloadProgress) => void): () => void
  /** absolute path of a dropped File (Electron removed File.path) */
  pathOf(file: File): string
}

export type ModrinthSort = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'

export interface ModrinthQuery {
  query: string
  sort: ModrinthSort
  limit: number
  offset: number
}

export interface ModrinthHit {
  slug: string
  title: string
  author: string
  description: string
  icon: string | null
  downloads: number
  follows: number
  updated: string
  /** side badge, then categories, then loaders */
  tags: string[]
}

export interface ModrinthPage {
  hits: ModrinthHit[]
  total: number
}

export interface AssetSource {
  id: string
  label: string
  kind: 'minecraft' | 'mod'
  /** false = the Minecraft jar still has to be downloaded */
  ready: boolean
}

export interface AssetEntry {
  /** entry name inside the jar */
  path: string
  ns: string
  /** 'block' = a block (its block state file); the others are files of the same name */
  kind: 'block' | 'texture' | 'model'
  group: 'block' | 'item'
  name: string
}

export interface DownloadProgress {
  what: string
  done: number
  total: number
}

/** A texture inside one of the sources, with a data URL to draw it. */
export interface FaceRef {
  src: string
  path: string
  url: string
}

export interface BlockFaces {
  top?: FaceRef
  side?: FaceRef
}
