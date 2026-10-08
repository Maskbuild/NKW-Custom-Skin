import { NODE_DEF_MAP, valueOf } from './nodes'
import type { Project } from './schema'

/** What the mod reads at runtime (skinmod.config.json), derived from the graph. */
export interface ModRuntimeConfig {
  maxSkins: number // -1 = unlimited
  key: { enabled: boolean; default: string }
  /** builtin = the Skin Station block exists; entries = connected Block nodes (a game block, or a block of our own) */
  block: { enabled: boolean; builtin: boolean; name: string; message: string; entries: { id: string; vanilla: string; name: string }[] }
  figura: { enabled: boolean }
  plasmo: { enabled: boolean }
  zone: { enabled: boolean; mode: 'hint' | 'instant'; message: string; width: number; length: number; height: number }
}

/** The project file used as the station block texture, or null for the built-in look. */
export function stationTexture(p: Project): string | null {
  const w = p.nodes.find((n) => n.type === 'skinWardrobe' && !n.disabled)
  const f = w ? valueOf(NODE_DEF_MAP.skinWardrobe, w.data, 'stationTexture') : ''
  return typeof f === 'string' && f && w && valueOf(NODE_DEF_MAP.skinWardrobe, w.data, 'blockEnabled') ? f : null
}

export interface PresetSkin {
  id: string
  name: string
  slim: boolean
  file: string // project-relative PNG
}

/** A block that opens the wardrobe. `vanilla` set = an existing game block; otherwise a new block `id` made from the textures. */
export interface BlockEntry {
  id: string
  vanilla: string
  name: string
  texture: string
  textureTop: string
}

const GAME_ID = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/

/** The Block nodes wired into the wardrobe's Blocks pin (only while the skin block is switched on). */
export function collectBlocks(p: Project): BlockEntry[] {
  const live = new Map(p.nodes.filter((n) => !n.disabled).map((n) => [n.id, n]))
  const w = [...live.values()].find((n) => n.type === 'skinWardrobe')
  if (!w || !valueOf(NODE_DEF_MAP.skinWardrobe, w.data, 'blockEnabled')) return []
  const gd = NODE_DEF_MAP.gameItem
  const used = new Set<string>()
  const out: BlockEntry[] = []
  for (const e of p.edges) {
    if (e.target !== w.id || e.targetHandle !== 'blocks') continue
    const n = live.get(e.source)
    if (!n || n.type !== 'gameItem' || valueOf(gd, n.data, 'kind') !== 'block') continue
    const custom = Boolean(valueOf(gd, n.data, 'custom'))
    const gameId = String(valueOf(gd, n.data, 'gameId')).trim().toLowerCase()
    const name = String(valueOf(gd, n.data, 'name')).trim() || 'Skin Block'
    let id = ''
    if (custom) {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'skin_block'
      id = /^[a-z]/.test(base) ? base : `block_${base}`
      for (let i = 2; used.has(id); i++) id = `${id.replace(/_\d+$/, '')}_${i}`
      used.add(id)
    } else if (!GAME_ID.test(gameId) || out.some((b) => b.vanilla === gameId)) continue
    out.push({ id, vanilla: custom ? '' : gameId, name, texture: String(n.data.texture ?? ''), textureTop: String(n.data.textureTop ?? '') })
  }
  return out
}

export function buildRuntimeConfig(p: Project): ModRuntimeConfig {
  const live = p.nodes.filter((n) => !n.disabled)
  const w = live.find((n) => n.type === 'skinWardrobe')
  const wd = NODE_DEF_MAP.skinWardrobe
  const get = (k: string): unknown => (w ? valueOf(wd, w.data, k) : wd.props.find((x) => x.key === k)?.default)
  const z = live.find((n) => n.type === 'skinZone')
  const zd = NODE_DEF_MAP.skinZone
  const zget = (k: string): unknown => (z ? valueOf(zd, z.data, k) : zd.props.find((x) => x.key === k)?.default)
  return {
    maxSkins: get('unlimited') ? -1 : Number(get('maxSkins')),
    key: { enabled: Boolean(get('keyEnabled')), default: String(get('key') || 'K').toUpperCase() },
    block: (() => {
      const enabled = Boolean(get('blockEnabled'))
      const entries = collectBlocks(p)
      return {
        enabled,
        builtin: enabled && entries.length === 0,
        name: String(get('blockName') || 'Skin Station'),
        message: String(get('blockMessage') ?? ''),
        entries: entries.map(({ id, vanilla, name }) => ({ id, vanilla, name }))
      }
    })(),
    figura: { enabled: live.some((n) => n.type === 'figura') },
    plasmo: { enabled: live.some((n) => n.type === 'plasmoVoice') },
    zone: {
      enabled: !!z,
      mode: zget('mode') === 'instant' ? 'instant' : 'hint',
      message: String(zget('message') ?? ''),
      width: Number(zget('width')),
      length: Number(zget('length')),
      height: Number(zget('height'))
    }
  }
}

/** Skin nodes wired into the (enabled) wardrobe: shipped inside the mod for everyone. */
export function collectPresets(p: Project): PresetSkin[] {
  const live = new Map(p.nodes.filter((n) => !n.disabled).map((n) => [n.id, n]))
  const wardrobe = [...live.values()].find((n) => n.type === 'skinWardrobe')
  if (!wardrobe) return []
  const sd = NODE_DEF_MAP.skin
  return p.edges
    .filter((e) => e.target === wardrobe.id && e.targetHandle === 'skins')
    .map((e) => live.get(e.source))
    .filter((n): n is NonNullable<typeof n> => !!n && n.type === 'skin')
    .map((n) => ({
      id: String(valueOf(sd, n.data, 'id')),
      name: String(valueOf(sd, n.data, 'name') || valueOf(sd, n.data, 'id')),
      slim: valueOf(sd, n.data, 'model') === 'slim',
      file: String(n.data.file ?? '')
    }))
}
