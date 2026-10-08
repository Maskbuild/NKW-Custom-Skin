/** Data-driven node definitions (shared by the editor, the validator and the exporter). */

export interface Text {
  en: string
  th: string
}

export type PinType = 'skin' | 'zone' | 'block'

/** A property must have this value. */
export interface Cond {
  key: string
  eq: string | number | boolean
}

export interface PinDef {
  id: string
  label: Text
  type: PinType
  /** input accepts many wires */
  multi?: boolean
  /** the pin only exists while the node's properties match (all of them) */
  showIf?: Cond | Cond[]
}

export type PropKind = 'text' | 'id' | 'number' | 'bool' | 'select' | 'asset' | 'key'

export interface PropDef {
  key: string
  label: Text
  kind: PropKind
  default: string | number | boolean
  options?: { value: string; label: Text }[]
  hint?: Text
  min?: number
  max?: number
  /** only show when other props have these values */
  showIf?: Cond | Cond[]
}

export interface NodeDef {
  type: string
  category: 'skins' | 'triggers' | 'blocks' | 'addons'
  icon: string
  title: Text
  description: Text
  props: PropDef[]
  inputs: PinDef[]
  outputs: PinDef[]
  /** at most one per project */
  unique?: boolean
  /** false = the current mod templates cannot build it yet (shown as an error) */
  available: boolean
}

export const CATEGORIES: Record<NodeDef['category'], { label: Text; color: string }> = {
  skins: { label: { en: 'Skins', th: 'สกิน' }, color: '#ec4899' },
  triggers: { label: { en: 'Triggers', th: 'ตัวเปิดใช้งาน' }, color: '#3b82f6' },
  blocks: { label: { en: 'Blocks & items', th: 'บล็อกและไอเทม' }, color: '#14b8a6' },
  addons: { label: { en: 'Add-ons', th: 'ส่วนเสริม' }, color: '#f59e0b' }
}

export const PIN_COLORS: Record<PinType, string> = { skin: '#ec4899', zone: '#22c55e', block: '#14b8a6' }

const t = (en: string, th: string): Text => ({ en, th })

export const NODE_DEFS: NodeDef[] = [
  {
    type: 'skinWardrobe',
    category: 'skins',
    icon: '👕',
    title: t('Skin wardrobe', 'ตู้เสื้อผ้าสกิน'),
    description: t(
      'The skin system: how players open the skin window and how many outfits they can keep.',
      'ระบบสกิน: ผู้เล่นเปิดหน้าต่างเปลี่ยนสกินอย่างไร และเก็บได้กี่ชุด'
    ),
    unique: true,
    available: true,
    inputs: [
      { id: 'skins', label: t('Preset skins', 'สกินที่แจก'), type: 'skin', multi: true },
      { id: 'zones', label: t('Zones', 'พื้นที่'), type: 'zone', multi: true },
      { id: 'blocks', label: t('Blocks', 'บล็อก'), type: 'block', multi: true, showIf: { key: 'blockEnabled', eq: true } }
    ],
    outputs: [],
    props: [
      { key: 'keyEnabled', label: t('Open with a key', 'เปิดด้วยปุ่ม'), kind: 'bool', default: true, showIf: { key: 'blockEnabled', eq: false }, hint: t('Not available with a skin block: the block opens the window instead.', 'ใช้ไม่ได้เมื่อใช้บล็อกเปลี่ยนสกิน: ให้คลิกที่บล็อกแทน') },
      {
        key: 'key',
        label: t('Default key', 'ปุ่มเริ่มต้น'),
        kind: 'key',
        default: 'K',
        showIf: [{ key: 'keyEnabled', eq: true }, { key: 'blockEnabled', eq: false }],
        hint: t('Players can rebind it in Controls.', 'ผู้เล่นเปลี่ยนได้ในหน้าตั้งค่าปุ่ม')
      },
      { key: 'blockEnabled', label: t('Skin changing block', 'บล็อกเปลี่ยนสกิน'), kind: 'bool', default: false, hint: t('Right-click the block to open the window. Connect Block nodes to choose which blocks do it; with none, a built-in Skin Station block is added. The key stops working.', 'คลิกขวาที่บล็อกเพื่อเปิดหน้าต่าง ต่อโหนดบล็อกเพื่อเลือกว่าบล็อกไหน ถ้าไม่ต่อจะมีบล็อก Skin Station ให้เอง ปุ่มกดจะใช้ไม่ได้') },
      { key: 'blockMessage', label: t('Message when looking at the block', 'ข้อความเมื่อมองที่บล็อก'), kind: 'text', default: 'Right-click to change your skin', showIf: { key: 'blockEnabled', eq: true } },
      { key: 'blockName', label: t('Built-in block name', 'ชื่อบล็อกในตัว'), kind: 'text', default: 'Skin Station', showIf: { key: 'blockEnabled', eq: true }, hint: t('Used when no Block node is connected.', 'ใช้เมื่อไม่ได้ต่อโหนดบล็อก') },
      {
        key: 'stationTexture',
        label: t('Block texture', 'เท็กซ์เจอร์บล็อก'),
        kind: 'asset',
        default: '',
        showIf: { key: 'blockEnabled', eq: true },
        hint: t('Any PNG in the project, e.g. a block texture imported from the game. Empty = the default wardrobe look.', 'PNG ใดก็ได้ในโปรเจกต์ เช่น เท็กซ์เจอร์บล็อกที่นำเข้าจากเกม ถ้าว่างใช้หน้าตาตู้เสื้อผ้าเริ่มต้น')
      },
      { key: 'unlimited', label: t('Unlimited outfits', 'เก็บได้ไม่จำกัด'), kind: 'bool', default: false },
      { key: 'maxSkins', label: t('Max outfits per player', 'จำนวนชุดสูงสุดต่อผู้เล่น'), kind: 'number', default: 10, min: 1, max: 1000, showIf: { key: 'unlimited', eq: false } }
    ]
  },
  {
    type: 'skin',
    category: 'skins',
    icon: '🧍',
    title: t('Skin', 'สกิน'),
    description: t(
      'A skin shipped inside the mod that every player can wear. Square PNG: 64, 128, 256, 512, 1024 or 2048 px.',
      'สกินที่แจกมากับม็อด ผู้เล่นทุกคนใส่ได้ ไฟล์ PNG จัตุรัส 64–2048 พิกเซล'
    ),
    available: true,
    inputs: [],
    outputs: [{ id: 'skin', label: t('Skin', 'สกิน'), type: 'skin' }],
    props: [
      { key: 'name', label: t('Display name', 'ชื่อที่แสดง'), kind: 'text', default: 'My Skin' },
      { key: 'id', label: t('Skin ID', 'ID สกิน'), kind: 'id', default: 'my_skin', hint: t('lowercase a-z, 0-9, _', 'ตัวพิมพ์เล็ก a-z, 0-9, _') },
      { key: 'file', label: t('Skin file', 'ไฟล์สกิน'), kind: 'asset', default: '' },
      {
        key: 'model',
        label: t('Arms', 'แขน'),
        kind: 'select',
        default: 'wide',
        options: [
          { value: 'wide', label: t('Wide (Steve)', 'กว้าง (Steve)') },
          { value: 'slim', label: t('Slim (Alex)', 'เรียว (Alex)') }
        ]
      }
    ]
  },
  {
    type: 'skinZone',
    category: 'triggers',
    icon: '🟩',
    title: t('Skin zone', 'พื้นที่เปลี่ยนสกิน'),
    description: t(
      'A zone block creators place in creative mode. Entering the area lets the player change skin. Size is set in game.',
      'บล็อกกำหนดพื้นที่ที่วางได้ในครีเอทีฟ เข้าไปในพื้นที่แล้วเปลี่ยนสกินได้ ปรับขนาดในเกม'
    ),
    available: true,
    inputs: [],
    outputs: [{ id: 'zone', label: t('Zone', 'พื้นที่'), type: 'zone' }],
    props: [
      {
        key: 'mode',
        label: t('When a player enters', 'เมื่อผู้เล่นเข้าพื้นที่'),
        kind: 'select',
        default: 'hint',
        options: [
          { value: 'hint', label: t('Show a hint on the hotbar', 'แสดงข้อความบน hotbar') },
          { value: 'instant', label: t('Open the window at once (closes on leave)', 'เปิดหน้าต่างทันที (ปิดเมื่อออก)') }
        ]
      },
      {
        key: 'message',
        label: t('Hotbar message', 'ข้อความบน hotbar'),
        kind: 'text',
        default: 'Press {{button}} to change your skin',
        showIf: { key: 'mode', eq: 'hint' },
        hint: t('{{button}} becomes the key the player set.', '{{button}} จะเปลี่ยนเป็นปุ่มที่ผู้เล่นตั้งไว้')
      },
      { key: 'width', label: t('Default width', 'ความกว้างเริ่มต้น'), kind: 'number', default: 8, min: 1, max: 256 },
      { key: 'length', label: t('Default length', 'ความยาวเริ่มต้น'), kind: 'number', default: 8, min: 1, max: 256 },
      { key: 'height', label: t('Default height', 'ความสูงเริ่มต้น'), kind: 'number', default: 4, min: 1, max: 256 }
    ]
  },
  {
    type: 'figura',
    category: 'addons',
    icon: '🎭',
    title: t('Figura', 'Figura'),
    description: t(
      'Optional add-on: each outfit can carry a Figura avatar that loads with the skin (icon next to its name). Without one, the current Figura avatar stays. Figura is not required.',
      'ส่วนเสริม (ไม่บังคับ): แต่ละชุดผูกอวาตาร์ Figura ได้ เลือกสกินแล้ว Figura มาด้วย (มีไอคอนต่อท้ายชื่อ) ถ้าไม่ได้ตั้งก็ใช้ Figura ปัจจุบัน ไม่ต้องมี Figura ก็เล่นได้'
    ),
    unique: true,
    available: true,
    inputs: [],
    outputs: [],
    props: []
  },
  {
    type: 'plasmoVoice',
    category: 'addons',
    icon: '🎙',
    title: t('Plasmo Voice', 'Plasmo Voice'),
    description: t(
      'Optional add-on: each outfit can have a talking skin (e.g. open mouth) shown while the player speaks. Needs Plasmo Voice on the players; not required.',
      'ส่วนเสริม (ไม่บังคับ): แต่ละชุดมีสกินตอนพูด (เช่น ปากเปิด) แสดงเมื่อผู้เล่นพูด ต้องมี Plasmo Voice ไม่บังคับ'
    ),
    unique: true,
    available: true,
    inputs: [],
    outputs: [],
    props: []
  },
  {
    type: 'gameItem',
    category: 'blocks',
    icon: '🧱',
    title: t('Block / item', 'บล็อก / ไอเทม'),
    description: t(
      'A block or item from the game or a mod (drag it from Game items). Connect a block to the wardrobe to make it open the skin window.',
      'บล็อกหรือไอเทมจากเกมหรือม็อด (ลากมาจากแท็บไอเทมในเกม) ต่อบล็อกเข้ากับตู้เสื้อผ้าเพื่อให้คลิกแล้วเปิดหน้าต่างสกิน'
    ),
    available: true,
    inputs: [],
    outputs: [{ id: 'block', label: t('Block', 'บล็อก'), type: 'block' }],
    props: [
      {
        key: 'kind',
        label: t('Type', 'ชนิด'),
        kind: 'select',
        default: 'block',
        options: [
          { value: 'block', label: t('Block', 'บล็อก') },
          { value: 'item', label: t('Item', 'ไอเทม') }
        ]
      },
      { key: 'gameId', label: t('Game ID', 'ID ในเกม'), kind: 'text', default: 'minecraft:stone', hint: t('For example minecraft:crafting_table or farmersdelight:stove.', 'เช่น minecraft:crafting_table หรือ farmersdelight:stove') },
      {
        key: 'custom',
        label: t('Make my own block from these textures', 'สร้างบล็อกของฉันเองจากเท็กซ์เจอร์เหล่านี้'),
        kind: 'bool',
        default: false,
        showIf: { key: 'kind', eq: 'block' },
        hint: t('Off: the game block above opens the window. On: a new block is added to your mod.', 'ปิด: คลิกบล็อกในเกมข้างบนแล้วเปิดหน้าต่าง เปิด: เพิ่มบล็อกใหม่เข้าม็อดของคุณ')
      },
      { key: 'name', label: t('Block name', 'ชื่อบล็อก'), kind: 'text', default: 'My Skin Block', showIf: [{ key: 'kind', eq: 'block' }, { key: 'custom', eq: true }] },
      { key: 'texture', label: t('Side texture / icon', 'เท็กซ์เจอร์ด้านข้าง / ไอคอน'), kind: 'asset', default: '' },
      { key: 'textureTop', label: t('Top texture', 'เท็กซ์เจอร์ด้านบน'), kind: 'asset', default: '', showIf: { key: 'kind', eq: 'block' } }
    ]
  }
]

export const NODE_DEF_MAP: Record<string, NodeDef> = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]))

export const defaultData = (def: NodeDef): Record<string, unknown> =>
  Object.fromEntries(def.props.map((p) => [p.key, p.default]))

/** A prop's value with the definition's default as fallback. */
export const valueOf = (def: NodeDef, data: Record<string, unknown>, key: string): unknown =>
  data[key] ?? def.props.find((p) => p.key === key)?.default

const holds = (def: NodeDef, data: Record<string, unknown>, cond?: Cond | Cond[]): boolean =>
  !cond || [cond].flat().every((c) => valueOf(def, data, c.key) === c.eq)

export const propVisible = (def: NodeDef, p: PropDef, data: Record<string, unknown>): boolean => holds(def, data, p.showIf)

export const pinVisible = (def: NodeDef, pin: PinDef, data: Record<string, unknown>): boolean => holds(def, data, pin.showIf)

/** Every project file a node points at through an "asset" property (skins, block textures …). */
export const assetFiles = (nodes: { type: string; data: Record<string, unknown> }[]): string[] => {
  const out = new Set<string>()
  for (const n of nodes) {
    for (const p of NODE_DEF_MAP[n.type]?.props ?? []) {
      const v = n.data[p.key]
      if (p.kind === 'asset' && typeof v === 'string' && v) out.add(v)
    }
  }
  return [...out]
}
