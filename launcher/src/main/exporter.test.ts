import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => path.resolve(__dirname, '..', '..'), getPath: () => os.tmpdir() }
}))

import { cleanText, renderProject, setProperties } from './exporter'
import { defaultProject } from '../shared/schema'

describe('exporter', () => {
  it('setProperties replaces and appends', () => {
    expect(setProperties('a=1\nb=2\n', { a: '9', c: '3' })).toBe('a=9\nb=2\nc=3\n')
  })

  it('renders template with project values', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'))
    const p = defaultProject('Cool Skins')
    p.nodes[0].data.unlimited = true
    renderProject(p, work, work)
    expect(fs.readFileSync(path.join(work, 'gradle.properties'), 'utf8')).toContain('mod_id=cool_skins')
    const cfg = JSON.parse(fs.readFileSync(path.join(work, 'src/main/resources/skinmod.config.json'), 'utf8'))
    expect(cfg.maxSkins).toBe(-1)
    expect(fs.existsSync(path.join(work, 'gradlew.bat'))).toBe(true)
    expect(fs.existsSync(path.join(work, 'build'))).toBe(false)
  })

  it('ships preset skins and names the station block', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'))
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'))
    fs.mkdirSync(path.join(proj, 'textures'))
    fs.writeFileSync(path.join(proj, 'textures', 'hero.png'), 'png')
    const p = defaultProject('Cool Skins')
    p.nodes[0].data = { blockEnabled: true, blockName: 'Dressing Room' }
    p.nodes.push({ id: 's1', type: 'skin', position: { x: 0, y: 0 }, data: { id: 'hero', file: 'textures/hero.png' } })
    p.edges.push({ id: 'e', source: 's1', sourceHandle: 'skin', target: 'wardrobe-1', targetHandle: 'skins' })
    renderProject(p, proj, work)
    const pre = path.join(work, 'src/main/resources/assets/skinmod')
    expect(fs.existsSync(path.join(pre, 'presets', 'hero.png'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(pre, 'presets', 'index.json'), 'utf8'))).toEqual([{ id: 'hero', name: 'My Skin', slim: false }])
    expect(JSON.parse(fs.readFileSync(path.join(pre, 'lang', 'en_us.json'), 'utf8'))['block.skinmod.skin_station']).toBe('Dressing Room')
  })

  it('writes Thai and other non-ASCII text as safe .properties escapes', () => {
    const out = setProperties('mod_name=x\n', { mod_name: 'สกิน \\ ok' })
    expect(out).toBe('mod_name=\\u0e2a\\u0e01\\u0e34\\u0e19 \\\\ ok\n')
    expect(/^[\x20-\x7e\n]*$/.test(out)).toBe(true)
  })

  it('removes characters that could break out of a JSON or TOML string', () => {
    expect(cleanText('He said "hi" \\ and \'\'\'x')).toBe("He said  hi    and 'x")
    expect(cleanText('line\nbreak')).toBe('line break')
  })

  it('uses a project texture for the station block', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'))
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'))
    fs.mkdirSync(path.join(proj, 'textures'))
    fs.writeFileSync(path.join(proj, 'textures', 'stone.png'), 'custom-texture')
    const p = defaultProject('Station')
    p.nodes[0].data = { blockEnabled: true, stationTexture: 'textures/stone.png' }
    renderProject(p, proj, work)
    expect(fs.readFileSync(path.join(work, 'src/main/resources/assets/skinmod/textures/block/skin_station.png'), 'utf8')).toBe('custom-texture')
  })
})
