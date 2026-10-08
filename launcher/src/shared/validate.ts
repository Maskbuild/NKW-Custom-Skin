import { NODE_DEF_MAP, assetFiles, valueOf, type Text } from './nodes'
import { SKIN_SIZES, isTargetSupported, type Project } from './schema'

export interface Diagnostic {
  severity: 'error' | 'warning'
  nodeId?: string
  message: Text
}

/** Pixel size of project assets (null = unreadable), filled in by the app. */
export type AssetInfo = Record<string, { w: number; h: number } | null>

const ID = /^[a-z][a-z0-9_]*$/

const t = (en: string, th: string): Text => ({ en, th })

export function validate(p: Project, assets: AssetInfo = {}): Diagnostic[] {
  const out: Diagnostic[] = []
  const live = p.nodes.filter((n) => !n.disabled)

  if (!isTargetSupported(p.meta.loader, p.meta.mcVersion)) {
    out.push({ severity: 'error', message: t(`No template for ${p.meta.loader} ${p.meta.mcVersion} yet`, `ยังไม่มีเทมเพลตสำหรับ ${p.meta.loader} ${p.meta.mcVersion}`) })
  }

  if (!live.some((n) => n.type === 'skinWardrobe')) {
    out.push({ severity: 'error', message: t('Add a Skin wardrobe node (the skin system)', 'ต้องมีโหนดตู้เสื้อผ้าสกิน (ระบบสกิน)') })
  }

  const seen = new Map<string, number>()
  for (const n of p.nodes) {
    const def = NODE_DEF_MAP[n.type]
    if (!def) {
      out.push({ severity: 'warning', nodeId: n.id, message: t(`Unknown node type "${n.type}" (kept in the project, ignored)`, `ไม่รู้จักชนิดโหนด "${n.type}" (เก็บไว้ในโปรเจกต์ แต่ไม่ถูกใช้)`) })
      continue
    }
    if (n.disabled) continue
    if (!def.available) {
      out.push({ severity: 'error', nodeId: n.id, message: t(`${def.title.en} is not supported by the current mod template yet — disable or delete it`, `${def.title.th} ยังใช้กับเทมเพลตม็อดปัจจุบันไม่ได้ — ปิดหรือลบโหนดนี้`) })
    }
    if (def.unique) {
      const c = (seen.get(n.type) ?? 0) + 1
      seen.set(n.type, c)
      if (c === 2) out.push({ severity: 'error', nodeId: n.id, message: t(`Only one "${def.title.en}" node is allowed`, `มีโหนด "${def.title.th}" ได้แค่โหนดเดียว`) })
    }
  }

  const ids = new Map<string, string>()
  for (const n of live) {
    if (n.type === 'skin') {
      const id = String(valueOf(NODE_DEF_MAP.skin, n.data, 'id') ?? '')
      if (!ID.test(id)) out.push({ severity: 'error', nodeId: n.id, message: t(`Invalid skin ID "${id}" (use a-z, 0-9, _)`, `ID สกิน "${id}" ไม่ถูกต้อง (ใช้ a-z, 0-9, _)`) })
      else if (ids.has(id)) out.push({ severity: 'error', nodeId: n.id, message: t(`Duplicate skin ID "${id}"`, `ID สกิน "${id}" ซ้ำกัน`) })
      ids.set(id, n.id)
      const file = String(n.data.file ?? '')
      if (!file) out.push({ severity: 'error', nodeId: n.id, message: t('Choose the skin file', 'ยังไม่ได้เลือกไฟล์สกิน') })
      else {
        const info = assets[file]
        if (info === null) out.push({ severity: 'error', nodeId: n.id, message: t(`Cannot read "${file}"`, `อ่านไฟล์ "${file}" ไม่ได้`) })
        else if (info && (info.w !== info.h || !(SKIN_SIZES as readonly number[]).includes(info.w))) {
          out.push({ severity: 'error', nodeId: n.id, message: t(`Skin must be square 64–2048 px (is ${info.w}×${info.h})`, `สกินต้องเป็นจัตุรัส 64–2048 พิกเซล (ตอนนี้ ${info.w}×${info.h})`) })
        }
      }
    }
    if (n.type === 'skin' && !p.edges.some((e) => e.source === n.id && live.some((w) => w.id === e.target && w.type === 'skinWardrobe'))) {
      out.push({ severity: 'warning', nodeId: n.id, message: t('This skin is not connected to the wardrobe, so it will not be included', 'สกินนี้ยังไม่ได้เชื่อมกับตู้เสื้อผ้า จึงจะไม่ถูกรวมในม็อด') })
    }
    if (n.type === 'skinWardrobe') {
      const d = NODE_DEF_MAP.skinWardrobe
      if (live.some((x) => x.type === 'skinZone') && valueOf(d, n.data, 'keyEnabled')) {
        out.push({ severity: 'warning', nodeId: n.id, message: t('Skin zones are in the mod, so the key only works inside a zone', 'มีพื้นที่เปลี่ยนสกินในม็อด ปุ่มจึงใช้ได้เฉพาะภายในพื้นที่') })
      }
      if (!valueOf(d, n.data, 'keyEnabled') && !valueOf(d, n.data, 'blockEnabled') && !p.edges.some((e) => e.target === n.id && e.targetHandle === 'zones')) {
        out.push({ severity: 'warning', nodeId: n.id, message: t('No way to open the wardrobe: enable the key, the block or connect a zone', 'ไม่มีทางเปิดตู้เสื้อผ้า: เปิดปุ่ม บล็อก หรือเชื่อมพื้นที่') })
      }
    }
  }

  // any other file a node points at must at least be readable
  for (const n of live) {
    if (n.type === 'skin') continue // checked above, with the size rules
    for (const f of assetFiles([n])) {
      if (assets[f] === null) out.push({ severity: 'error', nodeId: n.id, message: t(`Cannot read "${f}"`, `อ่านไฟล์ "${f}" ไม่ได้`) })
    }
  }

  const byId = new Map(p.nodes.map((n) => [n.id, n]))
  for (const e of p.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) out.push({ severity: 'warning', message: t('A wire points to a missing node', 'มีสายที่ชี้ไปยังโหนดที่ไม่มีอยู่') })
  }
  return out
}
