import { z } from 'zod'

export const LOADERS = ['fabric', 'forge'] as const
export const MC_VERSIONS = ['1.20.1', '1.21.1', '1.21.4'] as const
export type Loader = (typeof LOADERS)[number]
export type McVersion = (typeof MC_VERSIONS)[number]

export const LOADER_LABEL: Record<Loader, string> = { fabric: 'Fabric', forge: 'Forge' }

export interface TargetInfo {
  loader: Loader
  mc: McVersion
  /** Java the build needs */
  java: number
  /** Mods a test run can add (Mod Menu is Fabric only; Plasmo Voice has no Forge 1.21.4 build) */
  testMods: { modMenu: boolean; figura: boolean; plasmo: boolean }
}

/** Every target the exporter has a template for. */
export const TARGETS: ReadonlyArray<TargetInfo> = [
  { loader: 'fabric', mc: '1.20.1', java: 17, testMods: { modMenu: true, figura: true, plasmo: true } },
  { loader: 'fabric', mc: '1.21.1', java: 21, testMods: { modMenu: true, figura: true, plasmo: true } },
  { loader: 'fabric', mc: '1.21.4', java: 21, testMods: { modMenu: true, figura: true, plasmo: true } },
  { loader: 'forge', mc: '1.20.1', java: 17, testMods: { modMenu: false, figura: true, plasmo: true } },
  { loader: 'forge', mc: '1.21.1', java: 21, testMods: { modMenu: false, figura: true, plasmo: true } },
  { loader: 'forge', mc: '1.21.4', java: 21, testMods: { modMenu: false, figura: true, plasmo: false } }
]

export const targetInfo = (loader: Loader, mc: McVersion): TargetInfo | undefined =>
  TARGETS.find((t) => t.loader === loader && t.mc === mc)

export const isTargetSupported = (loader: Loader, mc: McVersion): boolean => !!targetInfo(loader, mc)

export const SKIN_SIZES = [64, 128, 256, 512, 1024, 2048] as const

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()),
  disabled: z.boolean().optional()
})

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string().nullish(),
  target: z.string(),
  targetHandle: z.string().nullish()
})

export const MetaSchema = z.object({
  name: z.string().min(1).max(64),
  modId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  modVersion: z.string().regex(/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,31}$/),
  description: z.string().default(''),
  logo: z.string().optional(), // path relative to the project folder
  loader: z.enum(LOADERS),
  mcVersion: z.enum(MC_VERSIONS)
})

export const ProjectSchema = z.object({
  version: z.literal(2),
  meta: MetaSchema,
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema)
})

export type Project = z.infer<typeof ProjectSchema>
export type Meta = z.infer<typeof MetaSchema>
export type GraphNode = z.infer<typeof GraphNodeSchema>
export type GraphEdge = z.infer<typeof GraphEdgeSchema>

export const toModId = (name: string): string => {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(s) && s.length >= 2 ? s.slice(0, 64) : `mod_${s}`.slice(0, 64)
}

/** Reads any saved project and returns the current shape (v1 projects had trigger/limit nodes). */
export function migrateProject(raw: unknown): Project {
  const r = raw as { version?: number; meta?: unknown; nodes?: { type: string; data: Record<string, unknown> }[] }
  if (r?.version === 1) {
    const trigger = r.nodes?.find((n) => n.type === 'skinTrigger')
    const limit = r.nodes?.find((n) => n.type === 'skinLimit')
    const maxSkins = typeof limit?.data.maxSkins === 'number' ? limit.data.maxSkins : 10
    return ProjectSchema.parse({
      version: 2,
      meta: r.meta,
      nodes: [
        {
          id: 'wardrobe-1',
          type: 'skinWardrobe',
          position: { x: 360, y: 120 },
          data: { keyEnabled: trigger?.data.mode !== 'block', unlimited: maxSkins < 0, maxSkins: Math.max(1, maxSkins) }
        }
      ],
      edges: []
    })
  }
  return ProjectSchema.parse(raw)
}

export const defaultProject = (name: string): Project => ({
  version: 2,
  meta: {
    name,
    modId: toModId(name),
    modVersion: '1.0.0',
    description: 'HD skin support',
    loader: 'fabric',
    mcVersion: '1.21.1'
  },
  nodes: [{ id: 'wardrobe-1', type: 'skinWardrobe', position: { x: 320, y: 120 }, data: {} }],
  edges: []
})
