import { useCallback, useState } from 'react'

const KEY = 'cms.layout'
export const DEFAULT_LAYOUT = { left: 280, right: 320, dock: 200 }
type Layout = typeof DEFAULT_LAYOUT

function load(): Layout {
  try {
    return { ...DEFAULT_LAYOUT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function useLayout(): [Layout, (k: keyof Layout, v: number) => void] {
  const [l, setL] = useState<Layout>(load)
  const set = useCallback((k: keyof Layout, v: number) => {
    setL((cur) => {
      const next = { ...cur, [k]: v }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }, [])
  return [l, set]
}

/** Drag handle between panes. `sign` = -1 when growing means moving left/up (right and bottom panes). */
export function Resizer({ dir, value, onChange, onReset, sign = 1 }: { dir: 'x' | 'y'; value: number; onChange: (v: number) => void; onReset: () => void; sign?: 1 | -1 }): React.JSX.Element {
  const start = (e: React.MouseEvent): void => {
    e.preventDefault()
    const p0 = dir === 'x' ? e.clientX : e.clientY
    const v0 = value
    const move = (ev: MouseEvent): void => {
      const d = ((dir === 'x' ? ev.clientX : ev.clientY) - p0) * sign
      onChange(Math.max(dir === 'x' ? 200 : 80, Math.min(dir === 'x' ? 560 : 520, v0 + d)))
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = dir === 'x' ? 'col-resize' : 'row-resize'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return <div className={`resizer ${dir}`} onMouseDown={start} onDoubleClick={onReset} />
}
