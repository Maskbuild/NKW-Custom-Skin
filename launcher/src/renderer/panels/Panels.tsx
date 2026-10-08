import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import type { FileNode } from '../../shared/ipc'

export function FilesPanel(): React.JSX.Element {
  const t = useT()
  const dir = useStore((s) => s.dir)!
  const [tree, setTree] = useState<FileNode[]>([])
  const [tick, setTick] = useState(0)
  useEffect(() => void window.api.listFiles(dir).then(setTree), [dir, tick])
  useEffect(() => {
    const h = (): void => setTick((x) => x + 1)
    window.addEventListener('cms:files', h)
    return () => window.removeEventListener('cms:files', h)
  }, [])
  const imp = async (sub: 'models' | 'textures'): Promise<void> => {
    await window.api.importFiles(dir, sub)
    setTick((x) => x + 1)
  }
  return (
    <div className="panel-pad">
      <div className="row">
        <button className="btn sm" onClick={() => imp('models')}>{t('files.model')}</button>
        <button className="btn sm" onClick={() => imp('textures')}>{t('files.texture')}</button>
      </div>
      {tree.length === 0 ? <div className="empty">{t('files.empty')}</div> : <Tree nodes={tree} depth={0} />}
    </div>
  )
}

function Tree({ nodes, depth }: { nodes: FileNode[]; depth: number }): React.JSX.Element {
  return <ul className="tree">{nodes.map((n) => <TreeItem key={n.path} n={n} depth={depth} />)}</ul>
}

function TreeItem({ n, depth }: { n: FileNode; depth: number }): React.JSX.Element {
  const [open, setOpen] = useState(depth === 0)
  const ext = n.name.split('.').pop()?.toLowerCase()
  const icon = n.dir ? (open ? '📂' : '📁') : ext === 'png' ? '🖼' : ext === 'json' ? '🧊' : '📄'
  return (
    <li>
      <div className="tree-row" style={{ paddingLeft: depth * 12 + 4 }} onClick={() => n.dir && setOpen(!open)}>
        <span className="chev">{n.dir ? (open ? '▾' : '▸') : ''}</span>
        {icon} <span className="ellipsis">{n.name}</span>
      </div>
      {n.dir && open && n.children && <Tree nodes={n.children} depth={depth + 1} />}
    </li>
  )
}

export function HistoryPanel(): React.JSX.Element {
  const t = useT()
  const history = useStore((s) => s.history)
  const dirty = useStore((s) => s.dirty)
  return (
    <div className="panel-pad">
      <button className="btn sm" onClick={() => void useStore.getState().commit('Snapshot').then(
          () => useStore.getState().toast('✓'),
          (e: Error) => useStore.getState().toast(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true)
        )}>{t('hist.commit')}</button>
      {history.length === 0 && <div className="empty">{t('hist.none')}</div>}
      {history.map((h) => (
        <div key={h.hash} className="commit">
          <div className="grow">
            <b className="ellipsis" style={{ display: 'block' }}>{h.message}</b>
            <small className="muted">{h.hash.slice(0, 7)} · {new Date(h.date).toLocaleString()}</small>
          </div>
          <button
            className="btn sm"
            onClick={() => {
              if (!dirty || confirm(t('hist.confirm'))) void useStore.getState().restore(h.hash)
            }}
          >
            {t('hist.restore')}
          </button>
        </div>
      ))}
    </div>
  )
}
