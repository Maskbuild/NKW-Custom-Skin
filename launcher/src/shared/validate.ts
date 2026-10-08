import { NODE_DEF_MAP, assetFiles, pinVisible, valueOf, type Text } from './nodes'
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
      if (live.some((x) => x.type === 'skinZone') && valueOf(d, n.data, 'keyEnabled') && !valueOf(d, n.data, 'blockEnabled')) {
        out.push({ severity: 'warning', nodeId: n.id, message: t('Skin zones are in the mod, so the key only works inside a zone', 'มีพื้นที่เปลี่ยนสกินในม็อด ปุ่มจึงใช้ได้เฉพาะภายในพื้นที่') })
      }
      if (!valueOf(d, n.data, 'keyEnabled') && !valueOf(d, n.data, 'blockEnabled') && !p.edges.some((e) => e.target === n.id && e.targetHandle === 'zones')) {
        out.push({ severity: 'warning', nodeId: n.id, message: t('No way to open the wardrobe: enable the key, the block or connect a zone', 'ไม่มีทางเปิดตู้เสื้อผ้า: เปิดปุ่ม บล็อก หรือเชื่อมพื้นที่') })
      }
    }
  }

  // Block / item nodes
  const wardrobe = live.find((n) => n.type === 'skinWardrobe')
  for (const n of live) {
    if (n.type !== 'gameItem') continue
    const d = NODE_DEF_MAP.gameItem
    const kind = String(valueOf(d, n.data, 'kind'))
    const gameId = String(valueOf(d, n.data, 'gameId')).trim()
    const custom = kind === 'block' && Boolean(valueOf(d, n.data, 'custom'))
    const wired = !!wardrobe && p.edges.some((e) => e.source === n.id && e.target === wardrobe.id)
    if (!custom && !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(gameId.toLowerCase())) {
      out.push({ severity: 'error', nodeId: n.id, message: t(`"${gameId}" is not a game id (like minecraft:stone)`, `"${gameId}" ไม่ใช่ ID ในเกม (เช่น minecraft:stone)`) })
    }
    if (!custom && !gameId.toLowerCase().startsWith('minecraft:') && wired) {
      out.push({ severity: 'warning', nodeId: n.id, message: t(`Players need the mod "${gameId.split(':')[0]}" for this block to exist`, `ผู้เล่นต้องมีม็อด "${gameId.split(':')[0]}" บล็อกนี้ถึงจะมีอยู่`) })
    }
    if (custom && !String(n.data.texture ?? '')) out.push({ severity: 'error', nodeId: n.id, message: t('Choose a texture for your block', 'เลือกเท็กซ์เจอร์ให้บล็อกของคุณ') })
    if (kind === 'item' && wired) out.push({ severity: 'error', nodeId: n.id, message: t('Only blocks can open the skin window, not items', 'มีแค่บล็อกที่เปิดหน้าต่างสกินได้ ไอเทมทำไม่ได้') })
    if (!wired) out.push({ severity: 'warning', nodeId: n.id, message: t('Not connected to the wardrobe, so it is not used', 'ยังไม่ได้ต่อกับตู้เสื้อผ้า จึงไม่ถูกใช้') })
  }
  // a wire into a pin that is switched off does nothing
  if (wardrobe) {
    const wd = NODE_DEF_MAP.skinWardrobe
    for (const e of p.edges) {
      const pin = wd.inputs.find((x) => x.id === e.targetHandle)
      if (e.target === wardrobe.id && pin && !pinVisible(wd, pin, wardrobe.data)) {
        out.push({ severity: 'warning', nodeId: wardrobe.id, message: t('A wire goes into a pin that is switched off (turn on "Skin changing block")', 'มีสายต่อเข้าช่องที่ปิดอยู่ (เปิด "บล็อกเปลี่ยนสกิน")') })
        break
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
