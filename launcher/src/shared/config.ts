import { NODE_DEF_MAP, valueOf } from './nodes'
import type { Project } from './schema'

/** What the mod reads at runtime (skinmod.config.json), derived from the graph. */
export interface ModRuntimeConfig {
  maxSkins: number // -1 = unlimited
  key: { enabled: boolean; default: string }
  block: { enabled: boolean; name: string }
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
    block: { enabled: Boolean(get('blockEnabled')), name: String(get('blockName') || 'Skin Station') },
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
