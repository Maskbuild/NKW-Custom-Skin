import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import type { AssetEntry, AssetSource, DownloadProgress } from '../../shared/ipc'

type Tab = 'block' | 'item' | 'model'
const PAGE = 60

const label = (e: AssetEntry): string => (e.ns === 'minecraft' ? e.name : `${e.ns}:${e.name}`)
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Blocks, items, models and textures from Minecraft and from mods, ready to be copied into the project. */
export function GameItemsPanel(): React.JSX.Element {
  const t = useT()
  const dir = useStore((s) => s.dir)!
  const mc = useStore((s) => s.meta!.mcVersion)
  const [sources, setSources] = useState<AssetSource[]>([])
  const [src, setSrc] = useState(`mc:${mc}`)
  const [entries, setEntries] = useState<AssetEntry[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<Tab>('block')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [needDownload, setNeedDownload] = useState<number | null>(null) // size in MB when the Minecraft jar is missing
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const asked = useRef(new Set<string>()) // thumbnail batches already requested

  const reloadSources = useCallback(async (): Promise<AssetSource[]> => {
    const list = await window.api.assetSources(dir, mc)
    setSources(list)
    return list
  }, [dir, mc])

  // project or Minecraft version changed
  useEffect(() => {
    setSrc(`mc:${mc}`)
    setEntries([])
    setThumbs({})
    asked.current.clear()
    setSel(new Set())
    reloadSources().catch((e) => setErr(errText(e)))
  }, [dir, mc, reloadSources])

  // the chosen source: find out whether it can be read, then list it
  useEffect(() => {
    let live = true
    setErr('')
    setEntries([])
    setPage(0)
    setSel(new Set())
    setNeedDownload(null)
    const source = sources.find((s) => s.id === src)
    if (!source) return
    const open = async (): Promise<void> => {
      if (!source.ready) {
        const info = await window.api.minecraftInfo(mc)
        if (!live) return
        if (!info.ready) return setNeedDownload(info.sizeMB)
      }
      const list = await window.api.listAssets(dir, src)
      if (live) setEntries(list)
    }
    open().catch((e) => live && setErr(errText(e)))
    return () => {
      live = false
    }
  }, [dir, mc, src, sources])

  useEffect(
    () =>
      window.api.onDownloadProgress((p) => {
        setProgress(p.done >= p.total && p.total > 0 ? null : p)
        if (p.done >= p.total && p.total > 0) setTimeout(() => void reloadSources(), 400)
      }),
    [reloadSources]
  )

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return entries.filter((e) => (tab === 'model' ? e.kind === 'model' : e.kind === 'texture' && e.group === tab) && (!n || label(e).toLowerCase().includes(n)))
  }, [entries, tab, q])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const visible = shown.slice(page * PAGE, page * PAGE + PAGE)

  // thumbnails for the visible textures, one batch per page
  useEffect(() => {
    const need = visible.filter((e) => e.kind === 'texture' && !thumbs[e.path]).map((e) => e.path)
    const key = `${src}|${need.join(',')}`
    if (!need.length || asked.current.has(key)) return
    asked.current.add(key)
    let live = true
    window.api
      .thumbnails(dir, src, need)
      .then((r) => live && setThumbs((old) => ({ ...old, ...r })))
      .catch((e) => live && setErr(errText(e)))
    return () => {
      live = false
    }
  }, [visible, thumbs, dir, src])

  const toggle = (p: string): void =>
    setSel((old) => {
      const next = new Set(old)
      if (!next.delete(p)) next.add(p)
      return next
    })

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const importSelected = (): Promise<void> =>
    run(async () => {
      const added = await window.api.importAssets(dir, src, [...sel])
      setSel(new Set())
      window.dispatchEvent(new CustomEvent('cms:files'))
      useStore.getState().toast(`✓ ${t('items.imported', { n: added.length })}`)
    })

  return (
    <div className="panel-pad gi">
      <div className="row">
        <select className="input grow" value={src} onChange={(e) => setSrc(e.target.value)}>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.kind === 'minecraft' ? '🧱 ' : '🧩 '}
              {s.label}
            </option>
          ))}
        </select>
        <button className="btn icon" title={t('items.refresh')} onClick={() => void reloadSources()}>↻</button>
      </div>
      <div className="row wrap">
        <button className="btn sm" disabled={busy} onClick={() => run(async () => { if (await window.api.addModFile(dir)) await reloadSources() })}>{t('items.addFile')}</button>
        <button className="btn sm" onClick={() => void window.api.openModBrowser()}>{t('items.modrinth')}</button>
      </div>

      {progress && (
        <div className="dl">
          <span className="ellipsis">{progress.what}</span>
          <progress value={progress.done} max={progress.total || undefined} />
        </div>
      )}
      {err && <p className="err">{err}</p>}

      {needDownload !== null && (
        <div className="dl-card">
          <p>{t('items.download', { mc, mb: needDownload })}</p>
          <button className="btn primary" disabled={busy} onClick={() => run(async () => { await window.api.downloadMinecraft(mc); await reloadSources() })}>{t('items.downloadBtn')}</button>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="seg">
            {(['block', 'item', 'model'] as Tab[]).map((k) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setPage(0) }}>{t(`items.${k}`)}</button>
            ))}
          </div>
          <input className="input" placeholder={t('items.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
          <div className="asset-grid">
            {visible.map((e) => (
              <button key={e.path} className={`asset${sel.has(e.path) ? ' on' : ''}`} title={`${label(e)}\n${e.path}`} onClick={() => toggle(e.path)}>
                {e.kind === 'texture' ? thumbs[e.path] ? <img className="pixel" src={thumbs[e.path]} alt="" draggable={false} /> : <span className="ph" /> : <span className="model">{ '{ }' }</span>}
                <small className="ellipsis">{label(e)}</small>
              </button>
            ))}
          </div>
          {shown.length === 0 && <div className="empty">{t('items.none')}</div>}
          <div className="row">
            <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
            <span className="muted grow center-text">{page + 1} / {pages} · {shown.length}</span>
            <button className="btn sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>›</button>
          </div>
          <button className="btn primary" disabled={!sel.size || busy} onClick={() => void importSelected()}>{t('items.import', { n: sel.size })}</button>
        </>
      )}
    </div>
  )
}
