import { useEffect, useMemo, useRef, useState } from 'react'
import { NODE_DEFS } from '../../shared/nodes'
import { useL, useT } from '../i18n'

/** Space-bar node picker at the mouse position. */
export function QuickAdd({ at, onPick, onClose }: { at: { x: number; y: number }; onPick: (type: string) => void; onClose: () => void }): React.JSX.Element {
  const t = useT()
  const L = useL()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return NODE_DEFS.filter((d) => !n || [d.title.en, d.title.th, d.description.en, d.description.th].some((s) => s.toLowerCase().includes(n)))
  }, [q])

  const left = Math.min(at.x, window.innerWidth - 300)
  const top = Math.min(at.y, window.innerHeight - 320)
  return (
    <>
      <div className="qa-bg" onMouseDown={onClose} />
      <div className="qa" style={{ left, top }}>
        <input
          ref={ref}
          className="input"
          placeholder={t('ws.search')}
          value={q}
          onChange={(e) => (setQ(e.target.value), setI(0))}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') (e.preventDefault(), setI((x) => Math.min(list.length - 1, x + 1)))
            else if (e.key === 'ArrowUp') (e.preventDefault(), setI((x) => Math.max(0, x - 1)))
            else if (e.key === 'Enter' && list[i]) onPick(list[i].type)
          }}
        />
        <div className="qa-list">
          {list.map((d, k) => (
            <div key={d.type} className={`lib-item${k === i ? ' hot' : ''}`} onMouseEnter={() => setI(k)} onClick={() => onPick(d.type)}>
              <span className="li-icon">{d.icon}</span>
              <div className="grow">
                {L(d.title)}
                <small className="ellipsis">{L(d.description)}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
