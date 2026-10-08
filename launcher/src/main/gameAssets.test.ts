import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { zipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }))

import { copyModFile, downloadMinecraft, importAssets, listAssets, listSources, minecraftInfo, thumbnails } from './gameAssets'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const text = (s: string): Uint8Array => new TextEncoder().encode(s)

function projectWithMod(): { dir: string; source: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-ga-'))
  fs.mkdirSync(path.join(dir, 'mods'))
  const jar = zipSync({
    'assets/farmersdelight/textures/block/stove.png': png,
    'assets/farmersdelight/textures/item/knife.png': png,
    'assets/farmersdelight/models/block/stove.json': text('{}'),
    'assets/farmersdelight/textures/gui/skip.png': png, // not a block/item: ignored
    'assets/farmersdelight/textures/block/../../../../evil.png': png, // traversal: ignored
    'assets/farmersdelight/textures/block/UPPER.png': png, // not a valid resource name: ignored
    'META-INF/MANIFEST.MF': text('x')
  })
  fs.writeFileSync(path.join(dir, 'mods', 'fd.jar'), jar)
  return { dir, source: 'mod:fd.jar' }
}

describe('game assets', () => {
  it('lists only block and item textures and models of a mod', () => {
    const { dir, source } = projectWithMod()
    const list = listAssets(dir, source)
    expect(list.map((e) => `${e.kind}:${e.group}:${e.name}`).sort()).toEqual(['model:block:stove', 'texture:block:stove', 'texture:item:knife'])
  })

  it('offers the project mods as sources, after Minecraft', () => {
    const { dir } = projectWithMod()
    expect(listSources(dir, '1.21.1').map((s) => s.id)).toEqual(['mc:1.21.1', 'mod:fd.jar'])
  })

  it('makes data-URL thumbnails and ignores names that are not listed', () => {
    const { dir, source } = projectWithMod()
    const t = thumbnails(dir, source, ['assets/farmersdelight/textures/block/stove.png', 'assets/farmersdelight/textures/block/../../../../evil.png', 'nonsense'])
    expect(Object.keys(t)).toEqual(['assets/farmersdelight/textures/block/stove.png'])
    expect(t['assets/farmersdelight/textures/block/stove.png']).toMatch(/^data:image\/png;base64,/)
  })

  it('imports into flat names inside the project folder', () => {
    const { dir, source } = projectWithMod()
    const out = importAssets(dir, source, ['assets/farmersdelight/textures/item/knife.png', 'assets/farmersdelight/models/block/stove.json'])
    expect(out.sort()).toEqual(['models/farmersdelight_block_stove.json', 'textures/farmersdelight_item_knife.png'])
    for (const f of out) expect(fs.existsSync(path.join(dir, f))).toBe(true)
  })

  it('refuses sources that point outside the project', () => {
    const { dir } = projectWithMod()
    expect(() => listAssets(dir, 'mod:../outside.jar')).toThrow()
    expect(() => listAssets(dir, 'whatever')).toThrow()
  })

  it('copies a chosen jar into mods/ and only accepts .jar files', () => {
    const { dir } = projectWithMod()
    const src = path.join(os.tmpdir(), 'My Mod (1).jar')
    fs.writeFileSync(src, 'x')
    expect(copyModFile(dir, src)).toBe('My_Mod__1_.jar')
    expect(() => copyModFile(dir, path.join(os.tmpdir(), 'a.txt'))).toThrow()
  })

  it('rejects odd Minecraft versions before touching the network', async () => {
    await expect(minecraftInfo('../../etc')).rejects.toThrow()
  })

  it.skipIf(!process.env.CMS_NET)('downloads the real client jar and lists blocks and items', async () => {
    expect((await minecraftInfo('1.21.1')).sizeMB).toBeGreaterThan(5)
    await downloadMinecraft('1.21.1', () => {})
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-ga-'))
    expect((await minecraftInfo('1.21.1')).ready).toBe(true)
    const list = listAssets(dir, 'mc:1.21.1')
    expect(list.filter((e) => e.kind === 'texture' && e.group === 'block').length).toBeGreaterThan(500)
    expect(list.some((e) => e.name === 'stone' && e.group === 'block')).toBe(true)
    expect(list.some((e) => e.kind === 'model' && e.name === 'cube_all')).toBe(true)
  }, 180_000)
})
