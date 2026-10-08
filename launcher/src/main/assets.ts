import fs from 'node:fs'
import path from 'node:path'

const MAX_DATA_URL = 12 * 1024 * 1024

/** Resolves a project-relative path and refuses anything outside the project folder. */
export function inside(dir: string, rel: string): string {
  const root = path.resolve(dir)
  const abs = path.resolve(root, rel)
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('Path escapes the project folder')
  return abs
}

export function importInto(dir: string, sub: 'models' | 'textures', paths: string[]): string[] {
  if (sub !== 'models' && sub !== 'textures') throw new Error('bad folder')
  const target = inside(dir, sub)
  fs.mkdirSync(target, { recursive: true })
  const out: string[] = []
  for (const p of paths) {
    if (!fs.statSync(p).isFile()) continue
    let name = path.basename(p)
    // never overwrite a different file silently
    const ext = path.extname(name)
    const stem = name.slice(0, name.length - ext.length)
    for (let i = 2; fs.existsSync(path.join(target, name)) && !sameFile(p, path.join(target, name)); i++) name = `${stem}_${i}${ext}`
    fs.copyFileSync(p, path.join(target, name))
    out.push(`${sub}/${name}`)
  }
  return out
}

function sameFile(a: string, b: string): boolean {
  try {
    const x = fs.readFileSync(a)
    const y = fs.readFileSync(b)
    return x.equals(y)
  } catch {
    return false
  }
}

/** Width/height from a PNG header (no decoding). */
export function pngInfo(dir: string, rel: string): { w: number; h: number } | null {
  try {
    const fd = fs.openSync(inside(dir, rel), 'r')
    try {
      const b = Buffer.alloc(24)
      if (fs.readSync(fd, b, 0, 24, 0) < 24) return null
      if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(12) !== 0x49484452) return null
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

export function dataUrl(dir: string, rel: string): string | null {
  try {
    const abs = inside(dir, rel)
    if (!abs.toLowerCase().endsWith('.png') || fs.statSync(abs).size > MAX_DATA_URL) return null
    return `data:image/png;base64,${fs.readFileSync(abs).toString('base64')}`
  } catch {
    return null
  }
}
