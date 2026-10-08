import { useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { IFolder, IPlus, ISettings, IX, Logo } from '../components/Icons'
import { SettingsDialog } from '../components/SettingsDialog'
import type { OpenedProject } from '../../shared/ipc'

export function Home(): React.JSX.Element {
  const t = useT()
  const settings = useStore((s) => s.settings)!
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('My Skin Mod')
  const [showSettings, setShowSettings] = useState(false)

  const open = async (fn: () => Promise<OpenedProject | null>): Promise<void> => {
    try {
      const r = await fn()
      if (r) useStore.getState().openProject(r.dir, r.project)
    } catch (e) {
      useStore.getState().toast((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true)
      useStore.getState().setSettings(await window.api.settings())
    }
  }

  return (
    <div className="home">
      <div className="titlebar">
        <div className="brand">
          <Logo /> {t('app.name')}
        </div>
        <div className="drag" />
        <button className="btn ghost" onClick={() => setShowSettings(true)}>
          <ISettings /> {t('home.settings')}
        </button>
      </div>

      <div className="home-body">
        <section className="hero">
          <div className="hero-logo"><Logo size={64} /></div>
          <h1>{t('app.name')}</h1>
          <p className="muted">{t('app.tagline')}</p>
          <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 18 }}>
            <button className="btn primary lg" onClick={() => setCreating(true)}>
              <IPlus /> {t('home.new')}
            </button>
            <button className="btn lg" onClick={() => open(window.api.openProject)}>
              <IFolder /> {t('home.open')}
            </button>
          </div>
        </section>

        <section>
          <h3 className="sec-title">{t('home.recent')}</h3>
          {settings.recent.length === 0 ? (
            <div className="empty">{t('home.noRecent')}</div>
          ) : (
            <div className="recent-grid">
              {settings.recent.map((r) => (
                <div key={r.dir} className="recent" role="button" tabIndex={0} onClick={() => open(() => window.api.openRecent(r.dir))} onKeyDown={(e) => e.key === 'Enter' && open(() => window.api.openRecent(r.dir))}>
                  <div className="recent-icon">{r.name.slice(0, 1).toUpperCase()}</div>
                  <div className="grow">
                    <b>{r.name}</b>
                    <div className="muted mono ellipsis">{r.modId}</div>
                    <div className="faint ellipsis" title={r.dir}>{r.dir}</div>
                  </div>
                  <button
                    className="btn ghost icon"
                    title={t('home.remove')}
                    onClick={async (e) => {
                      e.stopPropagation()
                      useStore.getState().setSettings(await window.api.forgetRecent(r.dir))
                    }}
                  >
                    <IX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {creating && (
        <div className="overlay" onMouseDown={() => setCreating(false)}>
          <form
            className="dialog"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) void open(() => window.api.createProject(name.trim())).then(() => setCreating(false))
            }}
          >
            <h2>{t('new.title')}</h2>
            <div className="field">
              <label>{t('new.name')}</label>
              <input className="input" autoFocus value={name} maxLength={64} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setCreating(false)}>{t('export.close')}</button>
              <button className="btn primary" disabled={!name.trim()}>{t('new.create')}</button>
            </div>
          </form>
        </div>
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
