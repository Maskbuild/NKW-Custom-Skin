import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, RecentProject } from '../shared/ipc'

const file = (): string => path.join(app.getPath('userData'), 'settings.json')

export function loadSettings(): AppSettings {
  try {
    const s = JSON.parse(fs.readFileSync(file(), 'utf8')) as Partial<AppSettings>
    return {
      lang: s.lang === 'en' ? 'en' : 'th',
      recent: Array.isArray(s.recent) ? s.recent.filter((r) => r && typeof r.dir === 'string').slice(0, 20) : [],
      lastExportDir: typeof s.lastExportDir === 'string' ? s.lastExportDir : undefined
    }
  } catch {
    return { lang: 'th', recent: [] }
  }
}

export function saveSettings(s: AppSettings): void {
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  const tmp = `${file()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2))
  fs.renameSync(tmp, file())
}

export function rememberProject(r: RecentProject): AppSettings {
  const s = loadSettings()
  s.recent = [r, ...s.recent.filter((x) => x.dir !== r.dir)].slice(0, 20)
  saveSettings(s)
  return s
}
