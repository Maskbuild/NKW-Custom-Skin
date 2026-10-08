import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'

export function ExportDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const running = useStore((s) => s.build.running)
  const errors = useStore((s) => s.diagnostics.filter((d) => d.severity === 'error').length)
  const [outDir, setOutDir] = useState<string | null>(settings?.lastExportDir ?? null)
  const [java, setJava] = useState<{ ok: boolean; version: string; required: number } | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const mcVersion = useStore((s) => s.meta?.mcVersion)
  useEffect(() => void window.api.checkJava(mcVersion).then(setJava), [mcVersion])

  const run = async (): Promise<void> => {
    if (!outDir) return
    const s = useStore.getState()
    await s.save()
    s.setBuild({ running: true, logs: [] })
    window.dispatchEvent(new CustomEvent('cms:dock', { detail: 'console' }))
    setResult(null)
    try {
      const r = await window.api.startBuild({ projectDir: s.dir!, outDir, task: 'build' })
      setResult(r.ok ? { ok: true, text: `${t('ws.exportDone')}: ${r.jar}` } : { ok: false, text: r.error ?? 'Failed' })
      if (r.ok) void s.commit('Export')
    } finally {
      s.setBuild({ running: false })
    }
  }

  return (
    <div className="overlay" onMouseDown={() => !running && onClose()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t('export.title')}</h2>
        <p className={java && !java.ok ? 'err' : 'muted'}>{java ? (java.ok ? `Java ✓ ${java.version}` : `${t('ws.javaMissing')} (${java.version})`) : '…'}</p>
        {errors > 0 && <p className="err">{t('ws.errorsFirst')} ({errors})</p>}
        <div className="field">
          <label>{t('export.folder')}</label>
          <div className="row">
            <span className="muted grow ellipsis">{outDir ?? t('export.none')}</span>
            <button className="btn sm" onClick={async () => setOutDir((await window.api.chooseDir()) ?? outDir)}>{t('export.pick')}</button>
          </div>
        </div>
        {result && <p className={result.ok ? 'ok' : 'err'} style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>{result.text}</p>}
        <div className="actions">
          <button className="btn" onClick={onClose} disabled={running}>{t('export.close')}</button>
          {result?.ok && outDir && <button className="btn" onClick={() => void window.api.openFolder(outDir)}>{t('ws.openOut')}</button>}
          <button className="btn primary" disabled={!outDir || running || errors > 0 || java?.ok === false} onClick={() => void run()}>
            <span>{running ? '…' : t('export.build')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
