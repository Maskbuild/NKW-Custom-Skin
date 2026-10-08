import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { CATEGORIES, NODE_DEFS } from '../../shared/nodes'
import { useStore } from '../store'
import { useL, useT } from '../i18n'
import { ISearch } from '../components/Icons'

export function Library(): React.JSX.Element {
  const t = useT()
  const L = useL()
  const rf = useReactFlow()
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const n = q.trim().toLowerCase()
    const defs = NODE_DEFS.filter((d) => !n || [d.title.en, d.title.th, d.description.en, d.description.th].some((s) => s.toLowerCase().includes(n)))
    return (Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((c) => ({ c, defs: defs.filter((d) => d.category === c) })).filter((g) => g.defs.length)
  }, [q])

  const addCentered = (type: string): void => {
    const el = document.querySelector('.canvas')?.getBoundingClientRect()
    const p = rf.screenToFlowPosition({ x: (el?.left ?? 0) + (el?.width ?? 600) / 2 - 100, y: (el?.top ?? 0) + (el?.height ?? 400) / 2 - 40 })
    useStore.getState().addNode(type, { x: Math.round(p.x / 16) * 16, y: Math.round(p.y / 16) * 16 })
  }

  return (
    <>
      <div className="lib-search">
        <ISearch size={14} />
        <input className="input" placeholder={t('ws.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="hint-box">{t('ws.addHint')}</p>
      {groups.map(({ c, defs }) => (
        <div key={c}>
          <div className="lib-cat">{L(CATEGORIES[c].label)}</div>
          {defs.map((d) => (
            <div
              key={d.type}
              className="lib-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/cms-node', d.type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onDoubleClick={() => addCentered(d.type)}
              title={L(d.description)}
            >
              <span className="li-icon">{d.icon}</span>
              <div className="grow">
                {L(d.title)} {!d.available && <span className="badge">{t('ws.soon')}</span>}
                <small className="ellipsis">{L(d.description)}</small>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
