import { app } from 'electron'
import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { isTargetSupported, migrateProject, type Project } from '../shared/schema'
import { buildRuntimeConfig, collectBlocks, collectPresets, stationTexture } from '../shared/config'
import { assetFiles } from '../shared/nodes'
import { validate } from '../shared/validate'
import { inside, pngInfo } from './assets'
import type { BuildTask, ExportResult } from '../shared/ipc'

export const templatesRoot = (): string =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'mod-templates')
    : path.resolve(app.getAppPath(), '..', 'mod-templates')

/** Java the build needs: Minecraft 1.20.x targets use 17, newer ones 21 (a newer JDK also works). */
export const requiredJava = (mc: string): number => (mc.startsWith('1.20') ? 17 : 21) // matches TARGETS in shared/schema.ts

export function checkJava(required = 21): Promise<{ ok: boolean; version: string; required: number }> {
  return new Promise((resolve) => {
    execFile('java', ['-version'], (err, _out, stderr) => {
      const m = /version "(\d+)/.exec(stderr || '')
      const major = m ? Number(m[1]) : 0
      resolve({ ok: !err && major >= required, version: (stderr || '').split('\n')[0] || 'java not found', required })
    })
  })
}

const SKIP = new Set(['build', '.gradle', '.git', 'run'])

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const s = path.join(src, e.name)
    const d = path.join(dest, e.name)
    if (e.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

/** A .properties value: Java reads these files as Latin-1, so backslashes and non-ASCII text are escaped. */
const propertyValue = (v: string): string =>
  v
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

/**
 * Free text (name, description) is pasted into fabric.mod.json and mods.toml, so it must not be able to break
 * out of a JSON or TOML string: no quotes, backslashes or control characters.
 */
export const cleanText = (v: string): string => v.replace(/[\u0000-\u001f\u007f"\\]/g, ' ').replace(/'{3,}/g, "'").trim()

/** Replace `key=value` lines in a .properties file. */
export function setProperties(text: string, values: Record<string, string>): string {
  let out = text
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k}=.*$`, 'm')
    const line = `${k}=${propertyValue(v)}`
    out = re.test(out) ? out.replace(re, () => line) : `${out.trimEnd()}\n${line}\n`
  }
  return out
}

/** Every .java file under a folder (used for the mod id token). */
function javaFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? javaFiles(p) : e.name.endsWith('.java') ? [p] : []
  })
}

/**
 * Builds the Gradle project for a target. Layers, later ones win:
 *   shared/resources        assets used by every target
 *   mc/<mc>/src             the game code shared by the loaders of that Minecraft version
 *   targets/<loader>-<mc>   build files + the loader layer (entry points, networking, registration)
 */
export function assembleTemplate(loader: string, mc: string, workDir: string): void {
  const root = templatesRoot()
  const target = path.join(root, 'targets', `${loader}-${mc}`)
  const common = path.join(root, 'mc', mc)
  if (!fs.existsSync(target) || !fs.existsSync(common)) throw new Error(`No template for ${loader} ${mc}`)
  // wipe previous sources but keep Gradle caches/outputs for fast rebuilds
  fs.rmSync(path.join(workDir, 'src'), { recursive: true, force: true })
  copyDir(path.join(root, 'shared', 'resources'), path.join(workDir, 'src', 'main', 'resources'))
  copyDir(path.join(common, 'src'), path.join(workDir, 'src'))
  copyDir(target, workDir) // the loader layer wins over the shared sources
}

/** Renders template + project into a Gradle project directory. */
export function renderProject(project: Project, projectDir: string, workDir: string): void {
  assembleTemplate(project.meta.loader, project.meta.mcVersion, workDir)
  for (const f of javaFiles(path.join(workDir, 'src'))) {
    const text = fs.readFileSync(f, 'utf8')
    if (text.includes('@@MOD_ID@@')) fs.writeFileSync(f, text.split('@@MOD_ID@@').join(project.meta.modId))
  }

  const propsFile = path.join(workDir, 'gradle.properties')
  const m = project.meta
  fs.writeFileSync(
    propsFile,
    setProperties(fs.readFileSync(propsFile, 'utf8'), {
      mod_id: m.modId,
      mod_name: cleanText(m.name) || m.modId,
      mod_version: m.modVersion,
      mod_description: cleanText(m.description) || cleanText(m.name) || m.modId,
      archives_base_name: m.modId
    })
  )

  const res = path.join(workDir, 'src', 'main', 'resources')
  fs.writeFileSync(path.join(res, 'skinmod.config.json'), JSON.stringify(buildRuntimeConfig(project), null, 2))

  // preset skins ship inside the jar
  const presets = collectPresets(project)
  const presetDir = path.join(res, 'assets', 'skinmod', 'presets')
  fs.mkdirSync(presetDir, { recursive: true })
  for (const pr of presets) fs.copyFileSync(inside(projectDir, pr.file), path.join(presetDir, `${pr.id}.png`))
  fs.writeFileSync(path.join(presetDir, 'index.json'), JSON.stringify(presets.map(({ id, name, slim }) => ({ id, name, slim })), null, 2))

  // the station block's name comes from the Skin wardrobe node
  const langFile = path.join(res, 'assets', 'skinmod', 'lang', 'en_us.json')
  const lang = JSON.parse(fs.readFileSync(langFile, 'utf8')) as Record<string, string>
  lang['block.skinmod.skin_station'] = buildRuntimeConfig(project).block.name
  fs.writeFileSync(langFile, JSON.stringify(lang, null, 2))

  // blocks of our own (Block nodes with "make my own block"): state, model, item model, texture, lang, loot table
  const asset = path.join(res, 'assets', 'skinmod')
  const writeJson = (file: string, data: unknown): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  }
  const blockNames: Record<string, string> = {}
  for (const b of collectBlocks(project).filter((x) => !x.vanilla)) {
    fs.mkdirSync(path.join(asset, 'textures', 'block'), { recursive: true })
    fs.copyFileSync(inside(projectDir, b.texture), path.join(asset, 'textures', 'block', `${b.id}.png`))
    const hasTop = !!b.textureTop && fs.existsSync(inside(projectDir, b.textureTop))
    if (hasTop) fs.copyFileSync(inside(projectDir, b.textureTop), path.join(asset, 'textures', 'block', `${b.id}_top.png`))
    writeJson(path.join(asset, 'blockstates', `${b.id}.json`), { variants: { '': { model: `skinmod:block/${b.id}` } } })
    writeJson(
      path.join(asset, 'models', 'block', `${b.id}.json`),
      hasTop
        ? { parent: 'minecraft:block/cube_column', textures: { end: `skinmod:block/${b.id}_top`, side: `skinmod:block/${b.id}` } }
        : { parent: 'minecraft:block/cube_all', textures: { all: `skinmod:block/${b.id}` } }
    )
    writeJson(path.join(asset, 'models', 'item', `${b.id}.json`), { parent: `skinmod:block/${b.id}` })
    writeJson(path.join(asset, 'items', `${b.id}.json`), { model: { type: 'minecraft:model', model: `skinmod:block/${b.id}` } }) // 1.21.2+
    blockNames[`block.skinmod.${b.id}`] = b.name
    const loot = { type: 'minecraft:block', pools: [{ rolls: 1, entries: [{ type: 'minecraft:item', name: `skinmod:${b.id}` }], conditions: [{ condition: 'minecraft:survives_explosion' }] }] }
    writeJson(path.join(res, 'data', 'skinmod', 'loot_table', 'blocks', `${b.id}.json`), loot) // 1.21+
    writeJson(path.join(res, 'data', 'skinmod', 'loot_tables', 'blocks', `${b.id}.json`), loot) // 1.20.1
  }
  if (Object.keys(blockNames).length) {
    const names = JSON.parse(fs.readFileSync(langFile, 'utf8')) as Record<string, string>
    fs.writeFileSync(langFile, JSON.stringify({ ...names, ...blockNames }, null, 2))
  }

  // a texture from the project (for example one taken from the game) replaces the station block look
  const station = stationTexture(project)
  if (station) fs.copyFileSync(inside(projectDir, station), path.join(res, 'assets', 'skinmod', 'textures', 'block', 'skin_station.png'))

  if (m.logo) {
    const logo = path.join(projectDir, m.logo)
    if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(res, 'assets', 'skinmod', 'icon.png'))
  }
}

let current: ReturnType<typeof spawn> | null = null
let cancelled = false

export function stopBuild(): void {
  if (!current) return
  cancelled = true
  if (process.platform === 'win32' && current.pid) spawn('taskkill', ['/pid', String(current.pid), '/T', '/F'])
  else current.kill('SIGTERM')
}

export async function exportMod(
  projectDir: string,
  outDir: string,
  task: BuildTask,
  log: (line: string) => void,
  testMods: { figura: boolean; plasmo: boolean } = { figura: false, plasmo: false }
): Promise<ExportResult> {
  if (current) return { ok: false, error: 'A build is already running' }
  try {
    const project = migrateProject(JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8')))
    if (!isTargetSupported(project.meta.loader, project.meta.mcVersion)) {
      return { ok: false, error: `${project.meta.loader} ${project.meta.mcVersion} is not available yet.` }
    }
    const assets: Record<string, { w: number; h: number } | null> = {}
    for (const f of assetFiles(project.nodes)) assets[f] = pngInfo(projectDir, f)
    const errors = validate(project, assets).filter((d) => d.severity === 'error')
    if (errors.length) return { ok: false, error: errors.map((e) => '- ' + e.message.en).join('\n') }

    const java = await checkJava(requiredJava(project.meta.mcVersion))
    if (!java.ok) return { ok: false, error: `JDK ${java.required}+ is required. Found: ${java.version}` }

    const workDir = path.join(app.getPath('userData'), 'build', `${project.meta.modId}-${project.meta.loader}-${project.meta.mcVersion}`)
    log(`> Rendering template into ${workDir}`)
    renderProject(project, projectDir, workDir)

    const isWin = process.platform === 'win32'
    const gradlew = path.join(workDir, isWin ? 'gradlew.bat' : 'gradlew')
    if (!isWin) fs.chmodSync(gradlew, 0o755)

    if (task === 'runClient') log(`> Test run with: Mod Menu${testMods.figura ? ', Figura' : ''}${testMods.plasmo ? ', Plasmo Voice' : ''}`)
    log(`> gradlew ${task} (the first build downloads Minecraft and may take several minutes)`)
    cancelled = false
    const code = await new Promise<number>((resolve, reject) => {
      const child = spawn(isWin ? `"${gradlew}"` : gradlew, [task, '--console=plain', ...(task === 'runClient' ? [`-Ptest_figura=${testMods.figura === true}`, `-Ptest_plasmo=${testMods.plasmo === true}`] : [])], { cwd: workDir, shell: isWin })
      current = child
      const pipe = (b: Buffer): void => b.toString().split(/\r?\n/).filter(Boolean).forEach(log)
      child.stdout.on('data', pipe)
      child.stderr.on('data', pipe)
      child.on('error', reject)
      child.on('close', (c) => resolve(c ?? 1))
    }).finally(() => {
      current = null
    })
    if (cancelled) return { ok: false, cancelled: true, error: 'Cancelled' }
    if (code !== 0) return { ok: false, error: `Gradle exited with code ${code}. See the console.` }
    if (task === 'runClient') return { ok: true }

    const libs = path.join(workDir, 'build', 'libs')
    const jar = fs.readdirSync(libs).find((f) => f.endsWith('.jar') && !f.endsWith('-sources.jar'))
    if (!jar) return { ok: false, error: 'Build finished but no jar was produced.' }
    fs.mkdirSync(outDir, { recursive: true })
    const dest = path.join(outDir, jar)
    fs.copyFileSync(path.join(libs, jar), dest)
    log(`> Done: ${dest}`)
    return { ok: true, jar: dest }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
