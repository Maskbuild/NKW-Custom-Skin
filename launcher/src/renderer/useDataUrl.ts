import { useEffect, useState } from 'react'

/** Project images as data URLs, loaded once per file (nodes and panels ask for the same few images again and again). */
const cache = new Map<string, string | null>()

export function useDataUrl(dir: string, rel?: string): string | null {
  const key = rel ? `${dir}|${rel}` : ''
  const [url, setUrl] = useState<string | null>(key && cache.has(key) ? (cache.get(key) ?? null) : null)
  useEffect(() => {
    if (!key || !rel) return setUrl(null)
    if (cache.has(key)) return setUrl(cache.get(key) ?? null)
    let live = true
    void window.api.assetDataUrl(dir, rel).then((u) => {
      cache.set(key, u)
      if (live) setUrl(u)
    })
    return () => {
      live = false
    }
  }, [dir, rel, key])
  return url
}

/** Forget a file (after it was replaced on disk). */
export function forgetDataUrl(dir: string, rel: string): void {
  cache.delete(`${dir}|${rel}`)
}
