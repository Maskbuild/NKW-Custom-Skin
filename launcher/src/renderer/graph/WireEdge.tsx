import { useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useStore } from '../store'
import { useT } from '../i18n'

/** A wire with a × button (shown on hover) that removes it. */
export function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style }: EdgeProps): React.JSX.Element {
  const t = useT()
  const [hover, setHover] = useState(false)
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return (
    <>
      <BaseEdge path={path} style={{ ...style, strokeWidth: hover ? 3.5 : 2 }} />
      <path d={path} fill="none" stroke="transparent" strokeWidth={22} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} />
      <EdgeLabelRenderer>
        <button
          className={`wire-x${hover ? ' show' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          title={t('wire.remove')}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => useStore.getState().disconnect([id])}
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  )
}
