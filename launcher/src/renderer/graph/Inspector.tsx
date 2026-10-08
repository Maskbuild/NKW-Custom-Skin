import { useEffect, useMemo, useState } from 'react'
import { NODE_DEF_MAP, propVisible, valueOf, type NodeDef, type PropDef } from '../../shared/nodes'
import { LOADERS, LOADER_LABEL, MC_VERSIONS, isTargetSupported, toModId, type Loader, type McVersion } from '../../shared/schema'
import { useStore } from '../store'
import { useL, useT } from '../i18n'
import type { FileNode } from '../../shared/ipc'
import { useDataUrl } from '../useDataUrl'
import { BlockCube } from '../components/BlockCube'

export function Inspector(): React.JSX.Element {
  const selected = useStore((s) => s.selected)
  return <div className="insp">{selected.length === 0 ? <ModProps /> : selected.length === 1 ? <NodeProps id={selected[0]} /> : <Many n={selected.length} />}</div>
}

function Many({ n }: { n: number }): React.JSX.Element {
  const t = useT()
  const s = useStore.getState()
  return (
    <>
      <h3>{t('insp.many', { n })}</h3>
      <NodeActions ids={s.selected} />
    </>
  )
}

function NodeActions({ ids }: { ids: string[] }): React.JSX.Element {
  const t = useT()
  const off = useStore((s) => ids.every((id) => s.nodes.find((n) => n.id === id)?.disabled))
  return (
    <div className="row wrap">
      <button className="btn sm" onClick={() => useStore.getState().toggleDisabled(ids)}>{off ? t('insp.enable') : t('insp.disable')}</button>
      <button className="btn sm" onClick={() => useStore.getState().duplicate()}>{t('insp.duplicate')}</button>
      <button className="btn sm danger" onClick={() => useStore.getState().removeNodes(ids)}>{t('insp.delete')}</button>
    </div>
  )
}

function ModProps(): React.JSX.Element {
  const t = useT()
  const meta = useStore((s) => s.meta)!
  const dir = useStore((s) => s.dir)!
  const set = useStore((s) => s.setMeta)
  return (
    <>
      <h3>{t('insp.mod')}</h3>
      <div className="field">
        <label>{t('insp.name')}</label>
        <input className="input" value={meta.name} maxLength={64} onChange={(e) => set({ name: e.target.value || 'Mod', modId: toModId(e.target.value) })} />
      </div>
      <div className="field">
        <label>{t('insp.modId')}</label>
        <input className="input mono" value={meta.modId} readOnly />
      </div>
      <div className="field">
        <label>{t('insp.version')}</label>
        <input className="input" value={meta.modVersion} onChange={(e) => set({ modVersion: e.target.value })} />
      </div>
      <div className="field">
        <label>{t('insp.desc')}</label>
        <textarea className="input" rows={3} value={meta.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div className="field">
        <label>{t('insp.logo')}</label>
        <div className="row">
          <LogoPreview dir={dir} rel={meta.logo} />
          <span className="muted grow ellipsis">{meta.logo ?? t('insp.logoDefault')}</span>
          <button className="btn sm" onClick={async () => { const l = await window.api.chooseLogo(dir); if (l) set({ logo: l }) }}>{t('insp.choose')}</button>
        </div>
      </div>
      <h3>{t('insp.target')}</h3>
      <div className="row">
        <select className="input" value={meta.loader} onChange={(e) => set({ loader: e.target.value as Loader })}>
          {LOADERS.map((l) => <option key={l} value={l}>{LOADER_LABEL[l]}</option>)}
        </select>
        <select className="input" value={meta.mcVersion} onChange={(e) => set({ mcVersion: e.target.value as McVersion })}>
          {MC_VERSIONS.map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      {!isTargetSupported(meta.loader, meta.mcVersion) && <p className="err">{t('insp.noTemplate')}</p>}
    </>
  )
}

function LogoPreview({ dir, rel }: { dir: string; rel?: string }): React.JSX.Element {
  const url = useDataUrl(dir, rel)
  return url ? <img className="thumb pixel" src={url} alt="" /> : <span className="thumb empty-thumb" />
}

function NodeProps({ id }: { id: string }): React.JSX.Element | null {
  const L = useL()
  const t = useT()
  const node = useStore((s) => s.nodes.find((n) => n.id === id))
  const diagnostics = useStore((s) => s.diagnostics)
  const issues = useMemo(() => diagnostics.filter((d) => d.nodeId === id), [diagnostics, id])
  const update = useStore((s) => s.updateData)
  const def = node ? NODE_DEF_MAP[node.type] : undefined
  if (!node || !def) return null
  return (
    <>
      <h3>{def.icon} {L(def.title)}</h3>
      <p className="muted">{L(def.description)}</p>
      {!def.available && <p className="err">{t('insp.notReady')}</p>}
      {node.type === 'gameItem' && <ItemPreview data={node.data} />}
      {def.props.filter((p) => propVisible(def, p, node.data)).map((p) => (
        <Prop key={p.key} def={def} p={p} value={valueOf(def, node.data, p.key)} onChange={(v) => update(id, { [p.key]: v })} />
      ))}
      {issues.map((d, i) => <p key={i} className={d.severity === 'error' ? 'err' : 'warn-text'}>⚠ {L(d.message)}</p>)}
      <NodeActions ids={[id]} />
    </>
  )
}

/** The block or item as the game shows it, larger, above the settings. */
function ItemPreview({ data }: { data: Record<string, unknown> }): React.JSX.Element | null {
  const dir = useStore((s) => s.dir)!
  const side = useDataUrl(dir, typeof data.texture === 'string' ? data.texture : undefined)
  const top = useDataUrl(dir, typeof data.textureTop === 'string' ? data.textureTop : undefined)
  if (!side && !top) return null
  return <div className="insp-preview">{data.kind === 'item' ? <img className="pixel" src={side ?? undefined} alt="" /> : <BlockCube top={top} side={side} size={96} />}</div>
}

function Prop({ p, value, onChange }: { def: NodeDef; p: PropDef; value: unknown; onChange: (v: string | number | boolean) => void }): React.JSX.Element {
  const L = useL()
  const label = L(p.label)
  const hint = p.hint ? <span className="hint">{L(p.hint)}</span> : null

  if (p.kind === 'bool') {
    return (
      <div className="field">
        <div className="row">
          <button className={`switch${value ? ' on' : ''}`} role="switch" aria-checked={Boolean(value)} onClick={() => onChange(!value)} />
          <span className="grow">{label}</span>
        </div>
        {hint}
      </div>
    )
  }
  return (
    <div className="field">
      <label>{label}</label>
      {p.kind === 'select' ? (
        <select className="input" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {p.options?.map((o) => <option key={o.value} value={o.value}>{L(o.label)}</option>)}
        </select>
      ) : p.kind === 'number' ? (
        <NumberInput value={Number(value)} min={p.min} max={p.max} onChange={onChange} />
      ) : p.kind === 'asset' ? (
        <AssetPicker value={String(value ?? '')} onChange={onChange} />
      ) : p.kind === 'key' ? (
        <input className="input mono" value={String(value)} maxLength={12} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      ) : (
        <input className="input" value={String(value)} onChange={(e) => onChange(p.kind === 'id' ? e.target.value.toLowerCase() : e.target.value)} />
      )}
      {hint}
    </div>
  )
}

function NumberInput({ value, min, max, onChange }: { value: number; min?: number; max?: number; onChange: (v: number) => void }): React.JSX.Element {
  // keep what the user types (e.g. an empty box) and only commit valid numbers
  const [text, setText] = useState(String(value))
  useEffect(() => setText((cur) => (Number(cur) === value ? cur : String(value))), [value])
  return (
    <input
      className="input"
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.trunc(n))))
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

function flatten(nodes: FileNode[]): string[] {
  return nodes.flatMap((n) => (n.dir ? flatten(n.children ?? []) : [n.path.replace(/\\/g, '/')]))
}

function AssetPicker({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const t = useT()
  const dir = useStore((s) => s.dir)!
  const info = useStore((s) => s.assetInfo[value])
  const [files, setFiles] = useState<string[]>([])
  const url = useDataUrl(dir, value || undefined)
  const reload = (): void => void window.api.listFiles(dir).then((tree) => setFiles(flatten(tree).filter((f) => f.startsWith('textures/') && f.toLowerCase().endsWith('.png'))))
  useEffect(reload, [dir])
  return (
    <>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('insp.none')}</option>
        {value && !files.includes(value) && <option value={value}>{value}</option>}
        {files.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <div className="row">
        <button
          className="btn sm"
          onClick={async () => {
            const [added] = await window.api.importFiles(dir, 'textures')
            reload()
            if (added) onChange(added)
          }}
        >
          {t('insp.import')}
        </button>
        {info && <span className={info.w === info.h ? 'badge' : 'badge err'}>{info.w}×{info.h}</span>}
      </div>
      {url && <img className="skin-preview pixel" src={url} alt="" />}
    </>
  )
}
