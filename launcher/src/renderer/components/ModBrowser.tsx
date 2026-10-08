import { useEffect, useState } from 'react'
import type { ModrinthPage, ModrinthSort } from '../../shared/ipc'

const SORTS: [ModrinthSort, string][] = [
  ['relevance', 'Relevance'],
  ['downloads', 'Downloads'],
  ['follows', 'Follow count'],
  ['newest', 'Recently published'],
  ['updated', 'Recently updated']
]
const VIEWS = [5, 10, 15, 20, 50, 100]
const LOADER_TAGS = new Set(['fabric', 'forge', 'neoforge', 'quilt', 'babric'])

const compact = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return days < 14 ? 'Last week' : `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return days < 60 ? 'Last month' : `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} year(s) ago`
}

/** Standalone Modrinth browser window (opened from the "Game items" view). */
export function ModBrowser(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ModrinthSort>('relevance')
  const [limit, setLimit] = useState(20)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<ModrinthPage | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<Record<string, string>>({}) // slug -> status text
  const [dl, setDl] = useState<{ what: string; done: number; total: number } | null>(null)

  useEffect(() => window.api.onDownloadProgress((p) => setDl(p.done >= p.total && p.total > 0 ? null : p)), [])

  const addToProject = async (slug: string): Promise<void> => {
    setAdded((a) => ({ ...a, [slug]: '…' }))
    try {
      await window.api.addModrinth(slug)
      setAdded((a) => ({ ...a, [slug]: '✓ Added to the project' }))
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      setAdded((a) => ({ ...a, [slug]: m }))
    }
  }

  useEffect(() => {
    let stale = false
    setBusy(true)
    setErr('')
    const t = setTimeout(() => {
      window.api
        .searchModrinth({ query, sort, limit, offset: page * limit })
        .then((d) => !stale && setData(d))
        .catch((e) => !stale && setErr(e instanceof Error ? e.message : String(e)))
        .finally(() => !stale && setBusy(false))
    }, 250)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [query, sort, limit, page])

  const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1
  const nums = [...new Set([0, page - 1, page, page + 1, pages - 1])].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b)

  return (
    <div className="mb">
      <div className="mb-bar">
        <input className="input mb-search" placeholder="Search mods…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} />
        <label className="mb-sel">
          Sort by:
          <select value={sort} onChange={(e) => { setSort(e.target.value as ModrinthSort); setPage(0) }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="mb-sel">
          View:
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0) }}>
            {VIEWS.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <span className="grow" />
        <div className="mb-pages">
          {nums.map((n, i) => (
            <span key={n}>
              {i > 0 && n - nums[i - 1] > 1 && <span className="muted">…</span>}
              <button className={n === page ? 'on' : ''} onClick={() => setPage(n)}>{n + 1}</button>
            </span>
          ))}
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>›</button>
        </div>
      </div>
      {err && <p className="err" style={{ padding: 12 }}>{err}</p>}
      {dl && <div className="dl" style={{ padding: '0 14px' }}><span className="ellipsis">{dl.what}</span><progress value={dl.done} max={dl.total || undefined} /></div>}
      <div className={`mb-list ${busy ? 'busy' : ''}`}>
        {data?.hits.map((h) => (
          <article key={h.slug} className="mb-card">
            {h.icon ? <img src={h.icon} alt="" /> : <div className="mb-noicon" />}
            <div className="mb-main">
              <h2>{h.title} <span className="muted">by {h.author}</span></h2>
              <p>{h.description}</p>
              <div className="mb-tags">
                {h.tags.slice(0, 6).map((t) => (
                  <span key={t} className={LOADER_TAGS.has(t) ? `tag ${t}` : 'tag'}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                ))}
                {h.tags.length > 6 && <span className="tag">+{h.tags.length - 6}</span>}
              </div>
            </div>
            <div className="mb-stats">
              <span>⬇ {compact(h.downloads)}</span>
              <span>♡ {compact(h.follows)}</span>
              <span className="muted">🕘 {ago(h.updated)}</span>
              <button className="btn sm" disabled={added[h.slug] === '…'} onClick={() => void addToProject(h.slug)}>+ Add to project</button>
              {added[h.slug] && added[h.slug] !== '…' && <span className={added[h.slug].startsWith('✓') ? 'ok' : 'err'} style={{ fontWeight: 400, maxWidth: 180, whiteSpace: 'normal', textAlign: 'right' }}>{added[h.slug]}</span>}
            </div>
          </article>
        ))}
        {data && data.hits.length === 0 && <div className="empty">No results.</div>}
      </div>
    </div>
  )
}
