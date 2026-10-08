import type { ModrinthHit, ModrinthPage, ModrinthQuery } from '../shared/ipc'

interface RawHit {
  slug: string
  title: string
  author: string
  description: string
  icon_url: string | null
  downloads: number
  follows: number
  date_modified: string
  categories: string[]
  display_categories: string[]
  client_side: string
  server_side: string
}

const SIDE = (c: string, s: string): string =>
  c !== 'unsupported' && s !== 'unsupported' ? 'Client or server' : c !== 'unsupported' ? 'Client' : 'Server'

const LOADERS = new Set(['fabric', 'forge', 'neoforge', 'quilt', 'babric'])

export async function searchModrinth(q: ModrinthQuery): Promise<ModrinthPage> {
  const limit = Math.min(Math.max(Math.trunc(q.limit) || 20, 1), 100)
  const offset = Math.max(Math.trunc(q.offset) || 0, 0)
  const sort = ['relevance', 'downloads', 'follows', 'newest', 'updated'].includes(q.sort) ? q.sort : 'relevance'
  const params = new URLSearchParams({
    query: q.query.slice(0, 200),
    index: sort,
    limit: String(limit),
    offset: String(offset),
    facets: JSON.stringify([['project_type:mod']])
  })
  const res = await fetch(`https://api.modrinth.com/v2/search?${params}`, {
    headers: { 'User-Agent': 'custom-mod-skin-launcher/0.1' }
  })
  if (!res.ok) throw new Error(`Modrinth ${res.status}`)
  const data = (await res.json()) as { hits: RawHit[]; total_hits: number }
  const hits: ModrinthHit[] = data.hits.map((h) => {
    const cats = h.display_categories ?? h.categories
    return {
      slug: h.slug,
      title: h.title,
      author: h.author,
      description: h.description,
      icon: h.icon_url,
      downloads: h.downloads,
      follows: h.follows,
      updated: h.date_modified,
      tags: [SIDE(h.client_side, h.server_side), ...cats.filter((c) => !LOADERS.has(c)), ...cats.filter((c) => LOADERS.has(c))]
    }
  })
  return { hits, total: data.total_hits }
}
