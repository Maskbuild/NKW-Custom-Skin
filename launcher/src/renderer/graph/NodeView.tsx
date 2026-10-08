import { memo, useCallback, useEffect, type CSSProperties } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { CATEGORIES, NODE_DEF_MAP, PIN_COLORS, valueOf, type PinDef } from '../../shared/nodes'
import { useStore } from '../store'
import { useL, useT } from '../i18n'

function Pin({ nodeId, pin, dir, on }: { nodeId: string; pin: PinDef; dir: 'in' | 'out'; on: boolean }): React.JSX.Element {
  const L = useL()
  return (
    <div
      className={`nk-pin ${dir === 'out' ? 'out' : 'in'}`}
      onMouseDownCapture={(e) => {
        // Alt+click a pin removes its wires (like Unreal) instead of starting a new one
        if (!e.altKey || !(e.target as HTMLElement).classList.contains('react-flow__handle')) return
        e.preventDefault()
        e.stopPropagation()
        const s = useStore.getState()
        s.disconnect(s.edges.filter((x) => (dir === 'in' ? x.target === nodeId && x.targetHandle === pin.id : x.source === nodeId && x.sourceHandle === pin.id)).map((x) => x.id))
      }}
    >
      <Handle
        type={dir === 'in' ? 'target' : 'source'}
        position={dir === 'in' ? Position.Left : Position.Right}
        id={pin.id}
        className={`pin${on ? ' on' : ''}${pin.multi ? ' multi' : ''}`}
        style={{ '--pin': PIN_COLORS[pin.type] } as CSSProperties}
        title={pin.type}
      />
      {L(pin.label)}
    </div>
  )
}

/** One-line summary under the title, so nodes can be read without selecting them. */
function summary(type: string, data: Record<string, unknown>): string {
  const def = NODE_DEF_MAP[type]
  const v = (k: string): unknown => valueOf(def, data, k)
  switch (type) {
    case 'skinWardrobe': {
      const how = [v('keyEnabled') ? `⌨ ${String(v('key'))}` : '', v('blockEnabled') ? '🧱' : ''].filter(Boolean).join(' · ')
      return `${how || '—'} · ${v('unlimited') ? '∞' : String(v('maxSkins'))}`
    }
    case 'skin':
      return `${String(v('id'))}${data.file ? ` · ${String(data.file).split('/').pop()}` : ''}`
    case 'skinZone':
      return `${String(v('mode'))} · ${String(v('width'))}×${String(v('length'))}×${String(v('height'))}`
    default:
      return ''
  }
}

export const NodeView = memo(function NodeView({ id, selected }: NodeProps): React.JSX.Element {
  const node = useStore(useCallback((s) => s.nodes.find((n) => n.id === id), [id]))
  const connected = useStore(
    useCallback(
      (s) =>
        s.edges
          .filter((e) => e.source === id || e.target === id)
          .map((e) => (e.target === id ? `i:${e.targetHandle}` : `o:${e.sourceHandle}`))
          .sort()
          .join('|'),
      [id]
    )
  )
  const bad = useStore(useCallback((s) => s.diagnostics.find((d) => d.nodeId === id)?.severity, [id]))
  const t = useT()
  const L = useL()
  const update = useUpdateNodeInternals()
  useEffect(() => update(id), [id, update])

  const def = node ? NODE_DEF_MAP[node.type] : undefined
  if (!node || !def) return <div className="nk missing">?</div>
  const on = new Set(connected ? connected.split('|') : [])
  const rows = Math.max(def.inputs.length, def.outputs.length)
  const sub = summary(node.type, node.data)

  return (
    <div className={`nk${selected ? ' sel' : ''}${node.disabled ? ' off' : bad ? ` ${bad}` : ''}`}>
      <div className="nk-head">
        <span className="dot" style={{ background: CATEGORIES[def.category].color }} />
        <span aria-hidden>{def.icon}</span>
        <span className="nk-title ellipsis">{L(def.title)}</span>
        {node.disabled && <span className="nk-off">{t('ws.disabled')}</span>}
      </div>
      {sub && <div className="nk-sub mono ellipsis">{sub}</div>}
      {rows > 0 && (
        <div className="nk-pins">
          {Array.from({ length: rows }, (_, i) => (
            <div className="nk-row" key={i}>
              {def.inputs[i] ? <Pin nodeId={id} pin={def.inputs[i]} dir="in" on={on.has(`i:${def.inputs[i].id}`)} /> : <span />}
              {def.outputs[i] ? <Pin nodeId={id} pin={def.outputs[i]} dir="out" on={on.has(`o:${def.outputs[i].id}`)} /> : <span />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
