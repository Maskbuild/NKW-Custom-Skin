import { app } from 'electron'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { inside } from './assets'
import type { AssetEntry, AssetSource, DownloadProgress } from '../shared/ipc'

/** Where downloads may come from: the official Mojang and Modrinth hosts, over HTTPS, nothing else. */
const ALLOWED_HOSTS = new Set(['piston-meta.mojang.com', 'piston-data.mojang.com', 'launchermeta.mojang.com', 'launcher.mojang.com', 'api.modrinth.com', 'cdn.modrinth.com'])
const MAX_CLIENT_BYTES = 120 * 1024 * 1024
const MAX_MOD_BYTES = 256 * 1024 * 1024
const MAX_ENTRY_BYTES = 8 * 1024 * 1024
const UA = { 'User-Agent': 'custom-mod-skin-launcher/0.1' }

const ASSET_RE = /^assets\/([a-z0-9_.-]+)\/(textures|models)\/(block|item)\/([a-z0-9_./-]+)\.(png|json)$/

/** Matches a jar entry name we are willing to touch; names with ".." are never accepted. */
const parseAsset = (name: string): RegExpExecArray | null => (name.includes('..') ? null : ASSET_RE.exec(name))

const gameDir = (): string => path.join(app.getPath('userData'), 'game')
const clientJar = (mc: string): string => path.join(gameDir(), mc, 'client.jar')

function checkMc(mc: string): string {
  if (!/^1\.\d{1,2}(\.\d{1,2})?$/.test(mc)) throw new Error('bad Minecraft version')
  return mc
}

function allowedUrl(raw: string): URL {
  const u = new URL(raw)
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) throw new Error(`Refusing to download from ${u.hostname}`)
  return u
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(allowedUrl(url), { headers: UA })
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`)
  return (await res.json()) as T
}

/** Streams a file to disk, checks its size limit and hash, and only then moves it into place. */
async function download(
  url: string,
  dest: string,
  algo: 'sha1' | 'sha512',
  expected: string,
  maxBytes: number,
  onProgress: (done: number, total: number) => void
): Promise<void> {
  const res = await fetch(allowedUrl(url), { headers: UA })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
  const total = Number(res.headers.get('content-length') ?? 0)
  if (total > maxBytes) throw new Error('The file is larger than allowed')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.part`
  const hash = createHash(algo)
  const out = fs.createWriteStream(tmp)
  let done = 0
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      done += chunk.byteLength
      if (done > maxBytes) throw new Error('The file is larger than allowed')
      hash.update(chunk)
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r))
      onProgress(done, total)
    }
    await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())))
    if (hash.digest('hex') !== expected.toLowerCase()) throw new Error('The downloaded file did not match its checksum')
    fs.renameSync(tmp, dest)
  } catch (e) {
    out.destroy()
    fs.rmSync(tmp, { force: true })
    throw e
  }
}

// ---- Minecraft client jar -------------------------------------------------------------------------

interface Manifest { versions: { id: string; url: string }[] }
interface VersionJson { downloads: { client: { url: string; sha1: string; size: number } } }

export async function minecraftInfo(mc: string): Promise<{ ready: boolean; sizeMB: number }> {
  checkMc(mc)
  if (fs.existsSync(clientJar(mc))) return { ready: true, sizeMB: 0 }
  const manifest = await getJson<Manifest>('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
  const v = manifest.versions.find((x) => x.id === mc)
  if (!v) throw new Error(`Minecraft ${mc} is not in the Mojang manifest`)
  const info = await getJson<VersionJson>(v.url)
  return { ready: false, sizeMB: Math.round(info.downloads.client.size / 1048576) }
}

export async function downloadMinecraft(mc: string, onProgress: (p: DownloadProgress) => void): Promise<void> {
  checkMc(mc)
  const manifest = await getJson<Manifest>('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
  const v = manifest.versions.find((x) => x.id === mc)
  if (!v) throw new Error(`Minecraft ${mc} is not in the Mojang manifest`)
  const c = (await getJson<VersionJson>(v.url)).downloads.client
  await download(c.url, clientJar(mc), 'sha1', c.sha1, MAX_CLIENT_BYTES, (done, total) => onProgress({ what: `Minecraft ${mc}`, done, total: total || c.size }))
  jarCache.delete(clientJar(mc))
}

// ---- mods ---------------------------------------------------------------------------------------

interface ModrinthVersion {
  version_number: string
  files: { url: string; filename: string; primary: boolean; hashes: { sha512: string } }[]
}

const safeFileName = (n: string): string => n.replace(/[^A-Za-z0-9._+-]/g, '_').slice(0, 120)

export function modsDir(projectDir: string): string {
  return inside(projectDir, 'mods')
}

/** Downloads the newest build of a Modrinth mod for this loader and Minecraft version into the project. */
export async function addModrinthMod(projectDir: string, slug: string, mc: string, loader: string, onProgress: (p: DownloadProgress) => void): Promise<string> {
  checkMc(mc)
  if (!/^[a-z0-9_-]{2,64}$/i.test(slug) || !/^[a-z]+$/.test(loader)) throw new Error('bad request')
  const q = new URLSearchParams({ game_versions: JSON.stringify([mc]), loaders: JSON.stringify([loader]) })
  const versions = await getJson<ModrinthVersion[]>(`https://api.modrinth.com/v2/project/${slug}/version?${q}`)
  const file = versions[0]?.files.find((f) => f.primary) ?? versions[0]?.files[0]
  if (!file) throw new Error(`No ${loader} build of this mod for Minecraft ${mc}`)
  if (!file.filename.toLowerCase().endsWith('.jar')) throw new Error('The download is not a .jar')
  const dest = path.join(modsDir(projectDir), safeFileName(file.filename))
  await download(file.url, dest, 'sha512', file.hashes.sha512, MAX_MOD_BYTES, (done, total) => onProgress({ what: slug, done, total }))
  return path.basename(dest)
}

export function copyModFile(projectDir: string, from: string): string {
  if (!from.toLowerCase().endsWith('.jar')) throw new Error('Choose a .jar file')
  const dest = path.join(modsDir(projectDir), safeFileName(path.basename(from)))
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(from, dest)
  return path.basename(dest)
}

// ---- sources, listing, thumbnails, import ---------------------------------------------------------

export function listSources(projectDir: string, mc: string): AssetSource[] {
  checkMc(mc)
  const out: AssetSource[] = [{ id: `mc:${mc}`, label: `Minecraft ${mc}`, kind: 'minecraft', ready: fs.existsSync(clientJar(mc)) }]
  const dir = modsDir(projectDir)
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.jar')).sort()) {
      out.push({ id: `mod:${f}`, label: f.replace(/\.jar$/i, ''), kind: 'mod', ready: true })
    }
  }
  return out
}

function jarPath(projectDir: string, sourceId: string): string {
  if (sourceId.startsWith('mc:')) return clientJar(checkMc(sourceId.slice(3)))
  if (sourceId.startsWith('mod:')) {
    const name = sourceId.slice(4)
    if (name !== path.basename(name)) throw new Error('bad source')
    return path.join(modsDir(projectDir), name)
  }
  throw new Error('bad source')
}

/** The last few jars, kept in memory: the vanilla jar is ~30 MB and thumbnails ask for it in small batches. */
const jarCache = new Map<string, Uint8Array>()
function readJar(file: string): Uint8Array {
  const hit = jarCache.get(file)
  if (hit) {
    jarCache.delete(file)
    jarCache.set(file, hit) // most recently used goes last
    return hit
  }
  const data = fs.readFileSync(file)
  jarCache.set(file, data)
  while (jarCache.size > 3) jarCache.delete(jarCache.keys().next().value as string)
  return data
}

export function listAssets(projectDir: string, sourceId: string): AssetEntry[] {
  const data = readJar(jarPath(projectDir, sourceId))
  const entries: AssetEntry[] = []
  unzipSync(data, {
    filter: (f) => {
      const m = parseAsset(f.name)
      if (m && f.originalSize <= MAX_ENTRY_BYTES) {
        entries.push({ path: f.name, ns: m[1], kind: m[2] === 'textures' ? 'texture' : 'model', group: m[3] as 'block' | 'item', name: m[4] })
      }
      return false // only listing: nothing is decompressed
    }
  })
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

/** Decompresses just the requested entries. */
function readEntries(projectDir: string, sourceId: string, paths: string[]): Record<string, Uint8Array> {
  const want = new Set(paths.filter((p) => parseAsset(p)))
  if (!want.size) return {}
  return unzipSync(readJar(jarPath(projectDir, sourceId)), { filter: (f) => want.has(f.name) && f.originalSize <= MAX_ENTRY_BYTES })
}

export function thumbnails(projectDir: string, sourceId: string, paths: string[]): Record<string, string> {
  const files = readEntries(projectDir, sourceId, paths.slice(0, 200).filter((p) => p.endsWith('.png')))
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`]))
}

/** Copies the chosen textures to textures/ and models to models/ in the project; returns the new project paths. */
export function importAssets(projectDir: string, sourceId: string, paths: string[]): string[] {
  const files = readEntries(projectDir, sourceId, paths.slice(0, 500))
  const out: string[] = []
  for (const [name, bytes] of Object.entries(files)) {
    const m = parseAsset(name)!
    const folder = m[2] === 'textures' ? 'textures' : 'models'
    const flat = `${m[1]}_${m[3]}_${m[4].replace(/\//g, '_')}.${m[5]}`
    const dest = inside(projectDir, `${folder}/${flat}`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, bytes)
    out.push(`${folder}/${flat}`)
  }
  return out
}
