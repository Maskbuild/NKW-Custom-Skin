import type { CSSProperties } from 'react'

const face = (url?: string | null): CSSProperties => (url ? { backgroundImage: `url(${url})` } : {})

/**
 * A block as the game shows it in an inventory: a small isometric cube with its top and side texture.
 * Textures taller than wide (animated ones) show their first frame.
 */
export function BlockCube({ top, side, size = 40 }: { top?: string | null; side?: string | null; size?: number }): React.JSX.Element {
  const e = size * 0.62 // edge length
  return (
    <span className="cube-wrap" style={{ width: size, height: size, ['--e' as string]: `${e}px` }}>
      <span className="cube">
        <i className="cf top" style={face(top ?? side)} />
        <i className="cf left" style={face(side ?? top)} />
        <i className="cf right" style={face(side ?? top)} />
      </span>
    </span>
  )
}
