import fs from 'node:fs'
import path from 'node:path'
import { simpleGit } from 'simple-git'
import { ProjectSchema, defaultProject, migrateProject, type Project } from '../shared/schema'
import type { FileNode, GitEntry } from '../shared/ipc'

const FILE = 'project.json'
const IGNORE = new Set(['.git', FILE, `${FILE}.tmp`])

export const readProject = (dir: string): Project =>
  migrateProject(JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8')))

/** Atomic save: write a temp file, then rename over the project file. */
export const writeProject = (dir: string, p: Project): void => {
  const tmp = path.join(dir, `${FILE}.tmp`)
  fs.writeFileSync(tmp, JSON.stringify(ProjectSchema.parse(p), null, 2))
  fs.renameSync(tmp, path.join(dir, FILE))
}

async function ensureRepo(dir: string) {
  const git = simpleGit(dir)
  if (!fs.existsSync(path.join(dir, '.git'))) {
    await git.init()
    await git.addConfig('user.name', 'Mod Skin Launcher')
    await git.addConfig('user.email', 'launcher@localhost')
  }
  return git
}

export async function createProject(parent: string, name: string): Promise<{ dir: string; project: Project }> {
  // a folder name, never a path: no separators, no leading dots (so not ".."), not empty
  const folder = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim().slice(0, 64) || 'mod'
  const dir = path.join(parent, folder)
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error('Folder already exists and is not empty')
  for (const sub of ['models', 'textures']) fs.mkdirSync(path.join(dir, sub), { recursive: true })
  const project = defaultProject(name)
  writeProject(dir, project)
  await commit(dir, 'Create project')
  return { dir, project }
}

const IGNORED = 'mods/\n*.part\n'

export async function commit(dir: string, message: string): Promise<void> {
  const git = await ensureRepo(dir)
  const ignore = path.join(dir, '.gitignore') // mod jars are large and come from the web: keep them out of the history
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, IGNORED)
  await git.add('.')
  const status = await git.status()
  if (status.files.length === 0) return
  await git.commit(message)
}

/** The history needs Git on the PATH; without it the list is simply empty. */
export async function history(dir: string): Promise<GitEntry[]> {
  try {
    const git = await ensureRepo(dir)
    const log = await git.log()
    return log.all.map((l) => ({ hash: l.hash, message: l.message, date: l.date }))
  } catch {
    return [] // no commits yet, or Git is not installed
  }
}

/** Restores project files to a commit as a *new* commit, so no history is lost. */
export async function restore(dir: string, hash: string): Promise<Project> {
  if (!/^[0-9a-f]{7,40}$/.test(hash)) throw new Error('bad hash')
  const git = await ensureRepo(dir)
  await git.raw(['checkout', hash, '--', '.'])
  await commit(dir, `Restore ${hash.slice(0, 7)}`)
  return readProject(dir)
}

export function listFiles(dir: string, rel = ''): FileNode[] {
  const abs = path.join(dir, rel)
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => !IGNORE.has(e.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((e) => {
      const p = path.join(rel, e.name)
      return e.isDirectory()
        ? { name: e.name, path: p, dir: true, children: listFiles(dir, p) }
        : { name: e.name, path: p, dir: false }
    })
}
