import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange
} from '@xyflow/react'
import { NODE_DEF_MAP, PIN_COLORS } from '../../shared/nodes'
import { useStore } from '../store'
import { NodeView } from './NodeView'
import { QuickAdd } from './QuickAdd'
import { WireEdge } from './WireEdge'

const nodeTypes = { skin: NodeView }
const edgeTypes = { wire: WireEdge }
const snap = (n: number): number => Math.round(n / 16) * 16

export function Canvas(): React.JSX.Element {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const selected = useStore((s) => s.selected)
  const rf = useReactFlow()
  const mouse = useRef({ x: 400, y: 300 })
  const [quick, setQuick] = useState<{ x: number; y: number } | null>(null)
  const [rfNodes, setRfNodes] = useState<Node[]>(() =>
    nodes.map((n) => ({ id: n.id, type: 'skin', position: n.position, selected: selected.includes(n.id), data: {} }))
  )

  // React Flow measures nodes itself; keep its measurements and take everything else from the store
  useEffect(() => {
    setRfNodes((prev) =>
      nodes.map((n) => {
        const old = prev.find((p) => p.id === n.id)
        return { ...old, id: n.id, type: 'skin', position: n.position, selected: selected.includes(n.id), data: {} }
      })
    )
  }, [nodes, selected])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((p) => applyNodeChanges(changes, p))
    const s = useStore.getState()
    const moved: Record<string, { x: number; y: number }> = {}
    let sel = s.selected
    let removed: string[] = []
    for (const c of changes) {
      if (c.type === 'position' && c.position) moved[c.id] = { x: snap(c.position.x), y: snap(c.position.y) }
      else if (c.type === 'select') sel = c.selected ? [...new Set([...sel, c.id])] : sel.filter((x) => x !== c.id)
      else if (c.type === 'remove') removed = [...removed, c.id]
    }
    if (Object.keys(moved).length) s.moveNodes(moved)
    if (removed.length) s.removeNodes(removed)
    else s.setSelected(sel)
  }, [])

  const flowEdges: Edge[] = edges.map((e) => {
    const src = nodes.find((n) => n.id === e.source)
    const pin = src ? NODE_DEF_MAP[src.type]?.outputs.find((p) => p.id === e.sourceHandle) : undefined
    return { ...e, type: 'wire', sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null, style: { stroke: pin ? PIN_COLORS[pin.type] : undefined, strokeWidth: 2 } }
  })

  const isValid = useCallback((c: Connection | Edge): boolean => {
    const s = useStore.getState()
    const a = s.nodes.find((n) => n.id === c.source)
    const b = s.nodes.find((n) => n.id === c.target)
    if (!a || !b || a.id === b.id) return false
    const out = NODE_DEF_MAP[a.type]?.outputs.find((p) => p.id === c.sourceHandle)
    const inp = NODE_DEF_MAP[b.type]?.inputs.find((p) => p.id === c.targetHandle)
    return !!out && !!inp && out.type === inp.type
  }, [])

  const addAt = useCallback(
    (type: string, client: { x: number; y: number }) => {
      const p = rf.screenToFlowPosition(client)
      useStore.getState().addNode(type, { x: snap(p.x), y: snap(p.y) })
    },
    [rf]
  )

  // keyboard: Space = quick add, Ctrl+E/D/C/V/Z/Y, F = fit
  useEffect(() => {
    const move = (e: MouseEvent): void => void (mouse.current = { x: e.clientX, y: e.clientY })
    const key = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement
      if (el?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const s = useStore.getState()
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (ctrl && k === 's') (e.preventDefault(), void s.save())
      else if (ctrl && k === 'z' && !e.shiftKey) (e.preventDefault(), s.undo())
      else if (ctrl && (k === 'y' || (e.shiftKey && k === 'z'))) (e.preventDefault(), s.redo())
      else if (ctrl && k === 'e') (e.preventDefault(), s.toggleDisabled())
      else if (ctrl && k === 'd') (e.preventDefault(), s.duplicate())
      else if (ctrl && k === 'c') s.copy()
      else if (ctrl && k === 'v') s.paste(rf.screenToFlowPosition(mouse.current))
      else if (ctrl && k === 'a') (e.preventDefault(), s.setSelected(s.nodes.map((n) => n.id)))
      else if (e.key === ' ' && !ctrl) (e.preventDefault(), setQuick({ ...mouse.current }))
      else if (k === 'f' && !ctrl) void rf.fitView({ padding: 0.2, duration: 300 })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('keydown', key)
    }
  }, [rf])

  return (
    <div
      className="canvas"
      onDragOver={(e) => e.dataTransfer.types.includes('application/cms-node') && (e.preventDefault(), (e.dataTransfer.dropEffect = 'copy'))}
      onDrop={(e) => {
        const type = e.dataTransfer.getData('application/cms-node')
        if (!type) return
        e.preventDefault()
        addAt(type, { x: e.clientX - 100, y: e.clientY - 20 })
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onEdgeContextMenu={(ev, edge) => { ev.preventDefault(); useStore.getState().disconnect([edge.id]) }}
        onNodesChange={onNodesChange}
        onNodeDragStart={() => useStore.getState().checkpoint()}
        onEdgesChange={(changes) => {
          const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id)
          if (removed.length) useStore.getState().disconnect(removed)
        }}
        onConnect={(c) => useStore.getState().connect(c)}
        isValidConnection={isValid}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        selectionKeyCode={null}
        panOnDrag={[1, 2]}
        selectionOnDrag
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.3}
        maxZoom={1.8}
        colorMode="system"
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="minimap" />
      </ReactFlow>
      {quick && (
        <QuickAdd
          at={quick}
          onClose={() => setQuick(null)}
          onPick={(type) => {
            addAt(type, quick)
            setQuick(null)
          }}
        />
      )}
    </div>
  )
}
