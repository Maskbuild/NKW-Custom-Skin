import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { LOADER_LABEL, TARGETS, targetInfo, type Loader, type McVersion } from '../../shared/schema'
import { useStore } from '../store'
import { useLang, useT } from '../i18n'
import { Canvas } from '../graph/Canvas'
import { Library } from '../graph/Library'
import { Inspector } from '../graph/Inspector'
import { Dock, type DockTab } from '../graph/Dock'
import { FilesPanel, HistoryPanel } from '../panels/Panels'
import { GameItemsPanel } from '../panels/GameItemsPanel'
import { DEFAULT_LAYOUT, Resizer, useLayout } from '../components/Resizer'
import { IAlert, IBox, IChevron, IDownload, IFiles, IFolder, IHistory, IHome, INodes, IPlay, IRedo, ISettings, IStop, IUndo, Logo } from '../components/Icons'
import { SettingsDialog } from '../components/SettingsDialog'
import { ExportDialog } from '../components/ExportDialog'

type SideView = 'library' | 'items' | 'files' | 'history'

const TEST_KEY = 'cms.testMods'

/** Which extra mods a test run loads. Mod Menu is always there; Figura / Plasmo Voice default to "on" when their node exists. */
function useTestMods(): [{ figura: boolean; plasmo: boolean }, (k: 'figura' | 'plasmo', v: boolean) => void] {
  const hasFigura = useStore((s) => s.nodes.some((n) => n.type === 'figura' && !n.disabled))
  const hasPlasmo = useStore((s) => s.nodes.some((n) => n.type === 'plasmoVoice' && !n.disabled))
  const [saved, setSaved] = useState<{ figura?: boolean; plasmo?: boolean }>(() => {
    try { return JSON.parse(localStorage.getItem(TEST_KEY) ?? '{}') } catch { return {} }
  })
  const set = (k: 'figura' | 'plasmo', v: boolean): void => {
    const next = { ...saved, [k]: v }
    setSaved(next)
    try { localStorage.setItem(TEST_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }
  return [{ figura: saved.figura ?? hasFigura, plasmo: saved.plasmo ?? hasPlasmo }, set]
}

function TestOptions({ mods, onChange }: { mods: { figura: boolean; plasmo: boolean }; onChange: (k: 'figura' | 'plasmo', v: boolean) => void }): React.JSX.Element {
  const t = useT()
  const meta = useStore((s) => s.meta)!
  const avail = targetInfo(meta.loader, meta.mcVersion)?.testMods ?? { modMenu: false, figura: false, plasmo: false }
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  const row = (label: string, checked: boolean, disabled: boolean, onToggle?: () => void): React.JSX.Element => (
    <label className={`opt-row${disabled ? ' dim' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} /> {label}
    </label>
  )
  return (
    <div className="test-opts" ref={box}>
      <button className="btn ghost icon" title={t('test.options')} onClick={() => setOpen(!open)}><IChevron size={14} style={{ transform: 'rotate(90deg)' }} /></button>
      {open && (
        <div className="popover">
          <div className="pop-title">{t('test.mods')}</div>
          {avail.modMenu && row('Mod Menu', true, true)}
          {row('Figura', avail.figura && mods.figura, !avail.figura, () => onChange('figura', !mods.figura))}
          {row('Plasmo Voice' + (avail.plasmo ? '' : ` (${t('test.noBuild')})`), avail.plasmo && mods.plasmo, !avail.plasmo, () => onChange('plasmo', !mods.plasmo))}
          <p className="muted pop-note">{t('test.note')}</p>
        </div>
      )}
    </div>
  )
}

function Titlebar({ onSettings, onExport }: { onSettings: () => void; onExport: () => void }): React.JSX.Element {
  const t = useT()
  const meta = useStore((s) => s.meta)!
  const dirty = useStore((s) => s.dirty)
  const saving = useStore((s) => s.saving)
  const running = useStore((s) => s.build.running)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const errors = useStore((s) => s.diagnostics.filter((d) => d.severity === 'error').length)
  const [testMods, setTestMod] = useTestMods()

  const test = async (): Promise<void> => {
    const s = useStore.getState()
    if (errors) {
      s.toast(t('ws.errorsFirst'), true)
      window.dispatchEvent(new CustomEvent('cms:dock', { detail: 'problems' }))
      return
    }
    await s.save()
    s.setBuild({ running: true, logs: [] })
    window.dispatchEvent(new CustomEvent('cms:dock', { detail: 'console' }))
    const r = await window.api.startBuild({
      projectDir: s.dir!,
      outDir: '',
      task: 'runClient',
      testMods: {
        figura: testMods.figura && (targetInfo(s.meta!.loader, s.meta!.mcVersion)?.testMods.figura ?? false),
        plasmo: testMods.plasmo && (targetInfo(s.meta!.loader, s.meta!.mcVersion)?.testMods.plasmo ?? false)
      }
    })
    s.setBuild({ running: false })
    if (!r.ok && !r.cancelled) s.toast(r.error ?? 'Failed', true)
  }

  return (
    <div className="titlebar">
      <button className="btn ghost icon" title={t('ws.home')} onClick={() => void useStore.getState().closeProject()}><IHome /></button>
      <Logo size={20} />
      <span className="proj-name ellipsis" title={meta.name}>{meta.name}</span>
      <span className="row">{dirty ? <span className="dirty-dot" title={saving ? t('ws.saving') : t('ws.unsaved')} /> : <span className="faint">{t('ws.saved')}</span>}</span>
      <span className="tb-sep" />
      <button className="btn ghost icon" disabled={!canUndo} title={`${t('ws.undo')} (Ctrl+Z)`} onClick={() => useStore.getState().undo()}><IUndo /></button>
      <button className="btn ghost icon" disabled={!canRedo} title={`${t('ws.redo')} (Ctrl+Y)`} onClick={() => useStore.getState().redo()}><IRedo /></button>
      <div className="drag" />
      <select
        className="input"
        style={{ width: 190 }}
        title={t('ws.target')}
        disabled={running}
        value={`${meta.loader}|${meta.mcVersion}`}
        onChange={(e) => { const [loader, mc] = e.target.value.split('|'); useStore.getState().setMeta({ loader: loader as Loader, mcVersion: mc as McVersion }) }}
      >
        {TARGETS.map((tg) => (
          <option key={`${tg.loader}|${tg.mc}`} value={`${tg.loader}|${tg.mc}`}>
            {LOADER_LABEL[tg.loader]} {tg.mc}
          </option>
        ))}
      </select>
      {running ? (
        <button className="btn danger" onClick={() => void window.api.stopBuild()}><IStop size={14} /> {t('ws.stop')}</button>
      ) : (
        <>
          <button className="btn primary" onClick={() => void test()} title="Ctrl+Enter"><IPlay size={14} /> {t('ws.test')}</button>
          <TestOptions mods={testMods} onChange={setTestMod} />
          <button className="btn" onClick={onExport}><IDownload size={14} /> {t('ws.export')}</button>
        </>
      )}
      <button className="btn ghost icon" title={t('home.settings')} onClick={onSettings}><ISettings /></button>
    </div>
  )
}

function ActivityBar({ side, onToggle, onSettings }: { side: SideView | null; onToggle: (v: SideView) => void; onSettings: () => void }): React.JSX.Element {
  const t = useT()
  const items: { id: SideView; icon: React.ReactNode; label: string }[] = [
    { id: 'library', icon: <INodes size={22} />, label: t('ws.library') },
    { id: 'items', icon: <IBox size={22} />, label: t('ws.items') },
    { id: 'files', icon: <IFiles size={22} />, label: t('ws.files') },
    { id: 'history', icon: <IHistory size={22} />, label: t('ws.history') }
  ]
  return (
    <nav className="activity">
      {items.map((it) => (
        <button key={it.id} className={side === it.id ? 'on' : ''} title={it.label} aria-label={it.label} onClick={() => onToggle(it.id)}>{it.icon}</button>
      ))}
      <div className="grow" />
      <button title={t('home.settings')} aria-label={t('home.settings')} onClick={onSettings}><ISettings size={22} /></button>
    </nav>
  )
}

function StatusBar(): React.JSX.Element {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const meta = useStore((s) => s.meta)!
  const diags = useStore((s) => s.diagnostics)
  const build = useStore((s) => s.build)
  const dirty = useStore((s) => s.dirty)
  const errors = diags.filter((d) => d.severity === 'error').length
  return (
    <footer className={`statusbar${build.running ? ' busy' : ''}`}>
      <button onClick={() => window.dispatchEvent(new CustomEvent('cms:dock', { detail: 'problems' }))} title={t('ws.problems')}>
        <IAlert size={13} /> {errors} · ⚠ {diags.length - errors}
      </button>
      <span>{LOADER_LABEL[meta.loader]} {meta.mcVersion}</span>
      {build.running && <span className="ellipsis">⟳ {build.logs[build.logs.length - 1] ?? ''}</span>}
      <div className="grow" />
      <span>{dirty ? t('ws.unsaved') : t('ws.saved')}</span>
      <button onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>{lang === 'th' ? 'ไทย' : 'EN'}</button>
    </footer>
  )
}

function Inner(): React.JSX.Element {
  const t = useT()
  const [layout, setLayout] = useLayout()
  const [side, setSide] = useState<SideView | null>('library')
  const [dockTab, setDockTab] = useState<DockTab>('problems')
  const [dockOpen, setDockOpen] = useState(true)
  const [settings, setSettings] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dropping, setDropping] = useState(false)
  const dir = useStore((s) => s.dir)!

  useEffect(() => window.api.onBuildLog((l) => useStore.getState().appendLog(l)), [])
  useEffect(() => {
    const h = (e: Event): void => { setDockTab((e as CustomEvent<DockTab>).detail); setDockOpen(true) }
    window.addEventListener('cms:dock', h)
    return () => window.removeEventListener('cms:dock', h)
  }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') (e.preventDefault(), document.querySelector<HTMLButtonElement>('.titlebar .btn.primary')?.click())
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') (e.preventDefault(), setSide((s) => (s ? null : 'library')))
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') (e.preventDefault(), setDockOpen((o) => !o))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const toggleSide = useCallback((v: SideView) => setSide((cur) => (cur === v ? null : v)), [])

  // drop PNGs anywhere to import them into textures/
  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDropping(false)
    const paths = [...e.dataTransfer.files].map((f) => window.api.pathOf(f)).filter((p) => p.toLowerCase().endsWith('.png'))
    if (!paths.length) return
    const added = await window.api.importFiles(dir, 'textures', paths)
    window.dispatchEvent(new CustomEvent('cms:files'))
    useStore.getState().toast(`✓ ${added.join(', ')}`)
  }

  return (
    <div
      className="ws"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false) }}
      onDrop={onDrop}
    >
      <Titlebar onSettings={() => setSettings(true)} onExport={() => setExporting(true)} />
      <div className="ws-main">
        <ActivityBar side={side} onToggle={toggleSide} onSettings={() => setSettings(true)} />
        {side && (
          <>
            <aside className="side" style={{ width: layout.left }}>
              <div className="side-title">{{ library: t('ws.library'), items: t('ws.items'), files: t('ws.files'), history: t('ws.history') }[side]}</div>
              <div className="side-body">
                {side === 'library' ? <Library /> : side === 'items' ? <GameItemsPanel /> : side === 'files' ? <FilesPanel /> : <HistoryPanel />}
              </div>
            </aside>
            <Resizer dir="x" value={layout.left} onChange={(v) => setLayout('left', v)} onReset={() => setLayout('left', DEFAULT_LAYOUT.left)} />
          </>
        )}
        <main className="center">
          <div className="editor-body"><Canvas /></div>
          {dockOpen && <Resizer dir="y" sign={-1} value={layout.dock} onChange={(v) => setLayout('dock', v)} onReset={() => setLayout('dock', DEFAULT_LAYOUT.dock)} />}
          <Dock tab={dockTab} setTab={setDockTab} open={dockOpen} setOpen={setDockOpen} height={layout.dock} />
        </main>
        <Resizer dir="x" sign={-1} value={layout.right} onChange={(v) => setLayout('right', v)} onReset={() => setLayout('right', DEFAULT_LAYOUT.right)} />
        <aside className="side right" style={{ width: layout.right }}>
          <div className="side-title">{t('ws.inspector')}</div>
          <div className="side-body"><Inspector /></div>
        </aside>
      </div>
      <StatusBar />
      {dropping && <div className="drop-hint"><IFolder size={28} /> {t('drop')}</div>}
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </div>
  )
}

export default function Workspace(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  )
}
