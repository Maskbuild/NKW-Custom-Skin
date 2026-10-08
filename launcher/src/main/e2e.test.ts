import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => path.resolve(__dirname, '..', '..'), getPath: () => os.tmpdir() }
}))

import { renderProject } from './exporter'
import { defaultProject, type Loader, type McVersion } from '../shared/schema'

/**
 * Renders a project that uses every node into CMS_E2E_OUT for the target in CMS_E2E_TARGET (e.g. "forge-1.21.1"),
 * ready for `gradlew build`. Skipped unless both are set; used to check the templates with real Gradle.
 */
const target = process.env.CMS_E2E_TARGET
const out = process.env.CMS_E2E_OUT

describe.skipIf(!target || !out)('e2e render', () => {
  it('renders every node for the target', () => {
    const [loader, mc] = target!.split('-')
    const proj = path.join(out!, '..', 'e2e-proj')
    fs.mkdirSync(path.join(proj, 'textures'), { recursive: true })
    // a real 64x64 PNG header is enough for the exporter
    const png = Buffer.alloc(100)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png)
    fs.writeFileSync(path.join(proj, 'textures', 'hero.png'), png)

    const p = defaultProject('E2E สกิน Skins')
    p.meta.loader = loader as Loader
    p.meta.mcVersion = mc as McVersion
    p.nodes[0].data = { blockEnabled: true, blockName: 'Dressing Room', maxSkins: 3 }
    p.nodes.push({ id: 's1', type: 'skin', position: { x: 0, y: 0 }, data: { id: 'hero', name: 'Hero', file: 'textures/hero.png' } })
    p.nodes.push({ id: 'z1', type: 'skinZone', position: { x: 0, y: 0 }, data: { mode: 'hint' } })
    p.nodes.push({ id: 'f1', type: 'figura', position: { x: 0, y: 0 }, data: {} })
    p.nodes.push({ id: 'v1', type: 'plasmoVoice', position: { x: 0, y: 0 }, data: {} })
    p.edges.push({ id: 'e', source: 's1', sourceHandle: 'skin', target: 'wardrobe-1', targetHandle: 'skins' })
    // one game block and one block of our own open the window
    p.nodes.push({ id: 'b1', type: 'gameItem', position: { x: 0, y: 0 }, data: { kind: 'block', gameId: 'minecraft:crafting_table' } })
    p.nodes.push({ id: 'b2', type: 'gameItem', position: { x: 0, y: 0 }, data: { kind: 'block', custom: true, name: 'Dressing Crate', texture: 'textures/hero.png', textureTop: 'textures/hero.png' } })
    for (const id of ['b1', 'b2']) p.edges.push({ id: 'e' + id, source: id, sourceHandle: 'block', target: 'wardrobe-1', targetHandle: 'blocks' })
    renderProject(p, proj, out!)
  })
})
