import { describe, expect, it } from 'vitest'
import { ProjectSchema, defaultProject, migrateProject, toModId } from './schema'
import { buildRuntimeConfig, collectBlocks, collectPresets } from './config'
import { validate } from './validate'

describe('schema', () => {
  it('default project is valid', () => {
    const p = ProjectSchema.parse(defaultProject('My Skin Mod'))
    expect(p.meta.modId).toBe('my_skin_mod')
    expect(validate(p)).toEqual([])
  })
  it('mod ids start with a letter', () => {
    expect(toModId('123 Skins!')).toMatch(/^[a-z][a-z0-9_]+$/)
  })
  it('migrates v1 projects', () => {
    const v1 = {
      version: 1,
      meta: defaultProject('Old').meta,
      nodes: [
        { id: 't', type: 'skinTrigger', position: { x: 0, y: 0 }, data: { mode: 'button' } },
        { id: 'l', type: 'skinLimit', position: { x: 0, y: 0 }, data: { maxSkins: -1 } }
      ],
      edges: []
    }
    const p = migrateProject(v1)
    expect(p.version).toBe(2)
    expect(buildRuntimeConfig(p).maxSkins).toBe(-1)
  })
})

describe('config', () => {
  const off = { figura: { enabled: false }, plasmo: { enabled: false } }
  const zoneOff = { enabled: false, mode: 'hint', message: 'Press {{button}} to change skin', width: 8, length: 8, height: 4 }
  it('uses node values and defaults', () => {
    const p = defaultProject('x1')
    expect(buildRuntimeConfig(p)).toEqual({ maxSkins: 10, key: { enabled: true, default: 'K' }, block: { enabled: false, builtin: false, name: 'Skin Station', message: 'Right-click to change your skin', entries: [] }, ...off, zone: { ...zoneOff, message: 'Press {{button}} to change your skin' } })
    p.nodes[0].data = { unlimited: true, keyEnabled: false, blockEnabled: true, blockName: 'Wardrobe' }
    const c = buildRuntimeConfig(p)
    expect(c.maxSkins).toBe(-1)
    expect(c.key.enabled).toBe(false)
    expect(c.block).toEqual({ enabled: true, builtin: true, name: 'Wardrobe', message: 'Right-click to change your skin', entries: [] })
  })

  it('uses the connected Block nodes instead of the built-in station', () => {
    const p = defaultProject('x1')
    p.nodes[0].data = { blockEnabled: true, blockMessage: 'Press right click' }
    p.nodes.push(
      { id: 'b1', type: 'gameItem', position: { x: 0, y: 0 }, data: { kind: 'block', gameId: 'minecraft:Crafting_Table' } },
      { id: 'b2', type: 'gameItem', position: { x: 0, y: 0 }, data: { kind: 'block', custom: true, name: 'My Skin Block', texture: 'textures/a.png', textureTop: 'textures/b.png' } },
      { id: 'b3', type: 'gameItem', position: { x: 0, y: 0 }, data: { kind: 'item', gameId: 'minecraft:apple' } }, // items cannot be skin blocks
      { id: 'b4', type: 'gameItem', position: { x: 0, y: 0 }, data: { kind: 'block', gameId: 'minecraft:stone' } } // not connected
    )
    for (const id of ['b1', 'b2', 'b3']) p.edges.push({ id: 'e' + id, source: id, sourceHandle: 'block', target: 'wardrobe-1', targetHandle: 'blocks' })
    const c = buildRuntimeConfig(p).block
    expect(c.builtin).toBe(false)
    expect(c.message).toBe('Press right click')
    expect(c.entries).toEqual([
      { id: '', vanilla: 'minecraft:crafting_table', name: 'My Skin Block' },
      { id: 'my_skin_block', vanilla: '', name: 'My Skin Block' }
    ])
    expect(collectBlocks(p)[1]).toMatchObject({ texture: 'textures/a.png', textureTop: 'textures/b.png' })
    // switched off: the wires are ignored and the built-in block is back
    p.nodes[0].data = { blockEnabled: false }
    expect(collectBlocks(p)).toEqual([])
  })

  it('gives two custom blocks with the same name different ids', () => {
    const p = defaultProject('x1')
    p.nodes[0].data = { blockEnabled: true }
    for (const id of ['a', 'b']) {
      p.nodes.push({ id, type: 'gameItem', position: { x: 0, y: 0 }, data: { kind: 'block', custom: true, name: 'Crate', texture: 'textures/a.png' } })
      p.edges.push({ id: 'e' + id, source: id, sourceHandle: 'block', target: 'wardrobe-1', targetHandle: 'blocks' })
    }
    expect(collectBlocks(p).map((b) => b.id)).toEqual(['crate', 'crate_2'])
  })
  it('flags the optional add-ons', () => {
    const p = defaultProject('x1')
    p.nodes.push({ id: 'f', type: 'figura', position: { x: 0, y: 0 }, data: {} }, { id: 'v', type: 'plasmoVoice', position: { x: 0, y: 0 }, data: {} })
    const c = buildRuntimeConfig(p)
    expect([c.figura.enabled, c.plasmo.enabled]).toEqual([true, true])
    expect(validate(p)).toEqual([])
  })
  it('reads the zone node', () => {
    const p = defaultProject('x1')
    p.nodes.push({ id: 'z', type: 'skinZone', position: { x: 0, y: 0 }, data: { mode: 'instant', width: 12 } })
    const z = buildRuntimeConfig(p).zone
    expect(z).toMatchObject({ enabled: true, mode: 'instant', width: 12, length: 8, height: 4 })
    p.nodes[1].disabled = true
    expect(buildRuntimeConfig(p).zone.enabled).toBe(false)
  })
  it('collects only skins wired to the wardrobe', () => {
    const p = defaultProject('x1')
    p.nodes.push({ id: 's1', type: 'skin', position: { x: 0, y: 0 }, data: { id: 'hero', name: 'Hero', file: 'textures/hero.png', model: 'slim' } })
    p.nodes.push({ id: 's2', type: 'skin', position: { x: 0, y: 0 }, data: { id: 'loose', file: 'textures/x.png' } })
    p.edges.push({ id: 'e', source: 's1', sourceHandle: 'skin', target: 'wardrobe-1', targetHandle: 'skins' })
    expect(collectPresets(p)).toEqual([{ id: 'hero', name: 'Hero', slim: true, file: 'textures/hero.png' }])
    expect(validate(p, { 'textures/hero.png': { w: 64, h: 64 }, 'textures/x.png': { w: 64, h: 64 } }).filter((d) => d.nodeId === 's2')).toHaveLength(1)
  })
})

describe('validate', () => {
  it('requires a wardrobe', () => {
    const p = defaultProject('x1')
    p.nodes = []
    expect(validate(p).some((d) => d.severity === 'error')).toBe(true)
  })
  it('warns that the key is zone-only when a zone exists', () => {
    const p = defaultProject('x1')
    p.nodes.push({ id: 'z', type: 'skinZone', position: { x: 0, y: 0 }, data: {} })
    expect(validate(p).some((d) => d.nodeId === 'wardrobe-1' && d.severity === 'warning')).toBe(true)
  })
  it('reports unknown node types as warnings and ignores them', () => {
    const p = defaultProject('x1')
    p.nodes.push({ id: 'q', type: 'nope', position: { x: 0, y: 0 }, data: {} })
    expect(validate(p).filter((d) => d.nodeId === 'q').every((d) => d.severity === 'warning')).toBe(true)
  })
  it('rejects a skin that is not a square power of two', () => {
    const p = defaultProject('x1')
    p.nodes.push({ id: 's', type: 'skin', position: { x: 0, y: 0 }, data: { id: 'a', file: 'textures/a.png' } })
    const d = validate(p, { 'textures/a.png': { w: 100, h: 100 } })
    expect(d.some((x) => x.nodeId === 's' && x.message.en.includes('square'))).toBe(true)
  })
  it('allows only one unique node', () => {
    const p = defaultProject('x1')
    p.nodes.push({ id: 'w2', type: 'skinWardrobe', position: { x: 0, y: 0 }, data: {} })
    expect(validate(p).some((d) => d.nodeId === 'w2')).toBe(true)
  })
})
