import { app } from 'electron'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { inside } from './assets'
import type { AssetEntry, AssetSource, BlockFaces, DownloadProgress, FaceRef } from '../shared/ipc'

/** Where downloads may come from: the official Mojang and Modrinth hosts, over HTTPS, nothing else. */
const ALLOWED_HOSTS = new Set(['piston-meta.mojang.com', 'piston-data.mojang.com', 'launchermeta.mojang.com', 'launcher.mojang.com', 'api.modrinth.com', 'cdn.modrinth.com'])
const MAX_CLIENT_BYTES = 120 * 1024 * 1024
const MAX_MOD_BYTES = 256 * 1024 * 1024
const MAX_ENTRY_BYTES = 8 * 1024 * 1024
const UA = { 'User-Agent': 'custom-mod-skin-launcher/0.1' }

const ASSET_RE = /^assets\/([a-z0-9_.-]+)\/(textures|models)\/(block|item)\/([a-z0-9_./-]+)\.(png|json)$/

const STATE_RE = /^assets\/([a-z0-9_.-]+)\/blockstates\/([a-z0-9_./-]+)\.json$/

/** Matches a jar entry name we are willing to touch; names with ".." are never accepted. */
const parseAsset = (name: string): RegExpExecArray | null => (name.includes('..') ? null : ASSET_RE.exec(name))
const parseState = (name: string): RegExpExecArray | null => (name.includes('..') ? null : STATE_RE.exec(name))

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
      const st = parseState(f.name)
      if (st && f.originalSize <= MAX_ENTRY_BYTES) {
        entries.push({ path: f.name, ns: st[1], kind: 'block', group: 'block', name: st[2] })
        return false
      }
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

/** Copies the chosen textures to textures/ and models to models/ in the project; returns jar entry -> project path. */
export function importAssets(projectDir: string, sourceId: string, paths: string[]): Record<string, string> {
  const files = readEntries(projectDir, sourceId, paths.slice(0, 500))
  const out: Record<string, string> = {}
  for (const [name, bytes] of Object.entries(files)) {
    const m = parseAsset(name)!
    const folder = m[2] === 'textures' ? 'textures' : 'models'
    const flat = `${m[1]}_${m[3]}_${m[4].replace(/\//g, '_')}.${m[5]}`
    const dest = inside(projectDir, `${folder}/${flat}`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, bytes)
    out[name] = `${folder}/${flat}`
  }
  return out
}


// ---- block previews --------------------------------------------------------------------------------

type Json = Record<string, unknown>

/** Reads one entry of a jar (null when missing). */
const entryCache = new Map<string, Uint8Array | null>()
function readOne(jar: string, name: string): Uint8Array | null {
  const key = jar + '|' + name
  if (entryCache.has(key)) return entryCache.get(key) ?? null
  if (!fs.existsSync(jar)) return null
  const hit = unzipSync(readJar(jar), { filter: (f) => f.name === name && f.originalSize <= MAX_ENTRY_BYTES })[name] ?? null
  if (entryCache.size > 3000) entryCache.clear() // a plain cap is enough: previews of one page need a few hundred entries
  entryCache.set(key, hit)
  return hit
}

function readJson(jars: string[], name: string): Json | null {
  for (const jar of jars) {
    const bytes = readOne(jar, name)
    if (!bytes) continue
    try {
      return JSON.parse(Buffer.from(bytes).toString('utf8')) as Json
    } catch {
      return null
    }
  }
  return null
}

const splitId = (id: string, defaultNs: string): [string, string] => {
  const i = id.indexOf(':')
  return i < 0 ? [defaultNs, id] : [id.slice(0, i), id.slice(i + 1)]
}

/** The first model a block state file points at. */
function stateModel(json: Json): string | null {
  const v = json.variants as Record<string, unknown> | undefined
  if (v) {
    const first = Object.values(v)[0]
    const one = Array.isArray(first) ? first[0] : first
    return typeof (one as Json | undefined)?.model === 'string' ? ((one as Json).model as string) : null
  }
  const mp = json.multipart as { apply?: unknown }[] | undefined
  const ap = mp?.[0]?.apply
  const one = Array.isArray(ap) ? ap[0] : ap
  return typeof (one as Json | undefined)?.model === 'string' ? ((one as Json).model as string) : null
}

/** Which texture variables are the top and the side of the well-known vanilla parent models. */
const PARENT_FACES: Record<string, { top: string[]; side: string[] }> = {
  cube_all: { top: ['all'], side: ['all'] },
  cube_column: { top: ['end'], side: ['side'] },
  cube_column_horizontal: { top: ['end'], side: ['side'] },
  cube_bottom_top: { top: ['top'], side: ['side'] },
  cube_top: { top: ['top'], side: ['side'] },
  orientable: { top: ['top'], side: ['front', 'side'] },
  orientable_vertical: { top: ['up', 'top'], side: ['side', 'front'] },
  cube: { top: ['up'], side: ['north', 'east', 'south', 'west'] },
  cube_mirrored_all: { top: ['all'], side: ['all'] },
  cube_directional: { top: ['up'], side: ['north'] },
  leaves: { top: ['all'], side: ['all'] },
  template_single_face: { top: ['texture'], side: ['texture'] }
}
const GUESS = ['side', 'all', 'texture', 'front', 'top', 'end', 'up', 'particle', 'layer0']

/** Walks a model's parent chain (inside the jars we can read) and returns its texture variables and the vanilla parent it ends at. */
function modelTextures(jars: string[], modelId: string, depth = 0): { textures: Record<string, string>; root: string | null } {
  if (depth > 8) return { textures: {}, root: null }
  const [ns, p] = splitId(modelId, 'minecraft')
  const json = readJson(jars, `assets/${ns}/models/${p}.json`)
  const own = Object.fromEntries(Object.entries((json?.textures as Record<string, unknown>) ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  const parent = typeof json?.parent === 'string' ? json.parent : null
  if (!json) {
    // not in a jar: a vanilla parent such as minecraft:block/cube_all is known by name
    const base = p.split('/').pop() ?? p
    return { textures: {}, root: ns === 'minecraft' ? base : null }
  }
  if (!parent) return { textures: own, root: null }
  const up = modelTextures(jars, parent, depth + 1)
  return { textures: { ...up.textures, ...own }, root: up.root }
}

function resolveVar(textures: Record<string, string>, key: string, depth = 0): string | null {
  const v = textures[key]
  if (!v || depth > 8) return null
  return v.startsWith('#') ? resolveVar(textures, v.slice(1), depth + 1) : v
}

/** Reads a texture from the source jar, then from Minecraft as a fallback. */
function faceRef(jars: { id: string; file: string }[], textureId: string, ns: string): FaceRef | null {
  const [tns, tp] = splitId(textureId, ns === 'minecraft' ? 'minecraft' : 'minecraft')
  const name = `assets/${tns}/textures/${tp}.png`
  if (name.includes('..') || !/^assets\/[a-z0-9_.-]+\/textures\/[a-z0-9_./-]+\.png$/.test(name)) return null
  for (const j of jars) {
    const bytes = readOne(j.file, name)
    if (bytes) return { src: j.id, path: name, url: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` }
  }
  return null
}

/** The top and side textures of blocks, found through their block state and model files. */
export function blockFaces(projectDir: string, sourceId: string, mc: string, names: string[]): Record<string, BlockFaces> {
  checkMc(mc)
  const main = { id: sourceId, file: jarPath(projectDir, sourceId) }
  const vanilla = { id: `mc:${mc}`, file: clientJar(mc) }
  const jars = main.id === vanilla.id ? [main] : [main, vanilla]
  const files = jars.map((j) => j.file)
  const out: Record<string, BlockFaces> = {}
  for (const name of names.slice(0, 120)) {
    const m = parseState(name)
    if (!m) continue
    const ns = m[1]
    const state = readJson(files, name)
    const model = (state && stateModel(state)) ?? `${ns}:block/${m[2]}`
    const { textures, root } = modelTextures(files, model)
    const rule = root ? PARENT_FACES[root] : undefined
    const pick = (keys: string[]): string | null => {
      for (const k of [...keys, ...GUESS]) {
        const v = resolveVar(textures, k)
        if (v) return v
      }
      return null
    }
    const topId = pick(rule?.top ?? ['top', 'up', 'end'])
    const sideId = pick(rule?.side ?? ['side', 'all', 'front'])
    const faces: BlockFaces = {}
    const top = topId ? faceRef(jars, topId, ns) : null
    const side = sideId ? faceRef(jars, sideId, ns) : null
    if (top) faces.top = top
    if (side) faces.side = side
    if (!faces.top && faces.side) faces.top = faces.side
    if (!faces.side && faces.top) faces.side = faces.top
    if (faces.top || faces.side) out[name] = faces
  }
  return out
}
