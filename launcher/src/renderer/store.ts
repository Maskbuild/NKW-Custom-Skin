import { create } from 'zustand'
import { NODE_DEF_MAP, assetFiles, defaultData, type NodeDef } from '../shared/nodes'
import { validate, type AssetInfo, type Diagnostic } from '../shared/validate'
import { type GraphEdge, type GraphNode, type Meta, type Project } from '../shared/schema'
import type { AppSettings, GitEntry } from '../shared/ipc'

interface Snapshot {
  meta: Meta
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface Toast {
  id: number
  text: string
  error?: boolean
}

interface State {
  settings: AppSettings | null
  dir: string | null
  meta: Meta | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  selected: string[]
  past: Snapshot[]
  future: Snapshot[]
  dirty: boolean
  saving: boolean
  diagnostics: Diagnostic[]
  assetInfo: AssetInfo
  history: GitEntry[]
  build: { running: boolean; logs: string[] }
  toasts: Toast[]
  clipboard: { nodes: GraphNode[]; edges: GraphEdge[] } | null

  setSettings(s: AppSettings): void
  openProject(dir: string, project: Project): void
  closeProject(): Promise<void>
  project(): Project | null
  /** push an undo step; steps with the same `key` within 700 ms are merged (typing, dragging) */
  checkpoint(key?: string): void
  undo(): void
  redo(): void
  setMeta(patch: Partial<Meta>): void
  addNode(type: string, position: { x: number; y: number }, data?: Record<string, unknown>): string | null
  updateData(id: string, patch: Record<string, unknown>): void
  moveNodes(pos: Record<string, { x: number; y: number }>): void
  removeNodes(ids: string[]): void
  setSelected(ids: string[]): void
  connect(c: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }): void
  disconnect(edgeIds: string[]): void
  toggleDisabled(ids?: string[]): void
  duplicate(): void
  copy(): void
  paste(at: { x: number; y: number }): void
  save(): Promise<void>
  commit(message: string): Promise<void>
  refreshHistory(): Promise<void>
  restore(hash: string): Promise<void>
  toast(text: string, error?: boolean): void
  appendLog(line: string): void
  setBuild(patch: Partial<State['build']>): void
}

const MAX_UNDO = 100
let lastKey = ''
let lastAt = 0
let toastId = 1
let nodeSeq = 1

const snap = (s: State): Snapshot => ({ meta: s.meta!, nodes: s.nodes, edges: s.edges })

export const useStore = create<State>((set, get) => ({
  settings: null,
  dir: null,
  meta: null,
  nodes: [],
  edges: [],
  selected: [],
  past: [],
  future: [],
  dirty: false,
  saving: false,
  diagnostics: [],
  assetInfo: {},
  history: [],
  build: { running: false, logs: [] },
  toasts: [],
  clipboard: null,

  setSettings: (settings) => set({ settings }),

  openProject(dir, p) {
    lastKey = ''
    set({
      dir,
      meta: p.meta,
      nodes: p.nodes,
      edges: p.edges,
      selected: [],
      past: [],
      future: [],
      dirty: false,
      assetInfo: {},
      build: { running: false, logs: [] }
    })
    void get().refreshHistory()
  },

  async closeProject() {
    if (get().dirty) await get().save()
    set({ dir: null, meta: null, nodes: [], edges: [], selected: [], diagnostics: [] })
    void window.api.settings().then((s) => set({ settings: s }))
  },

  project: () => {
    const s = get()
    return s.meta ? { version: 2, meta: s.meta, nodes: s.nodes, edges: s.edges } : null
  },

  checkpoint(key = '') {
    const s = get()
    if (!s.meta) return
    const now = Date.now()
    if (key && key === lastKey && now - lastAt < 700) {
      lastAt = now
      return
    }
    lastKey = key
    lastAt = now
    set({ past: [...s.past.slice(-(MAX_UNDO - 1)), snap(s)], future: [] })
  },

  undo() {
    const s = get()
    const prev = s.past[s.past.length - 1]
    if (!prev) return
    lastKey = ''
    set({ past: s.past.slice(0, -1), future: [...s.future, snap(s)], ...prev, selected: [], dirty: true })
  },
  redo() {
    const s = get()
    const next = s.future[s.future.length - 1]
    if (!next) return
    lastKey = ''
    set({ future: s.future.slice(0, -1), past: [...s.past, snap(s)], ...next, selected: [], dirty: true })
  },

  setMeta(patch) {
    get().checkpoint('meta')
    set((s) => ({ meta: { ...s.meta!, ...patch }, dirty: true }))
  },

  addNode(type, position, data) {
    const def: NodeDef | undefined = NODE_DEF_MAP[type]
    if (!def) return null
    const s = get()
    if (def.unique && s.nodes.some((n) => n.type === type)) {
      s.toast(`${def.title.en}: only one allowed`, true)
      return null
    }
    s.checkpoint()
    const id = `${type}-${Date.now().toString(36)}${nodeSeq++}`
    set({ nodes: [...s.nodes, { id, type, position, data: { ...defaultData(def), ...data } }], selected: [id], dirty: true })
    return id
  },

  updateData(id, patch) {
    get().checkpoint(`data:${id}:${Object.keys(patch).join(',')}`)
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)), dirty: true }))
  },

  moveNodes(pos) {
    set((s) => ({ nodes: s.nodes.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)), dirty: true }))
  },

  removeNodes(ids) {
    if (!ids.length) return
    const s = get()
    s.checkpoint()
    const gone = new Set(ids)
    set({
      nodes: s.nodes.filter((n) => !gone.has(n.id)),
      edges: s.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
      selected: s.selected.filter((x) => !gone.has(x)),
      dirty: true
    })
  },

  setSelected: (ids) => {
    const cur = get().selected
    if (ids.length === cur.length && ids.every((x, i) => x === cur[i])) return
    set({ selected: ids })
  },

  connect(c) {
    const s = get()
    const dup = s.edges.some((e) => e.source === c.source && e.target === c.target && e.sourceHandle === c.sourceHandle && e.targetHandle === c.targetHandle)
    if (dup) return
    s.checkpoint()
    // a single-input pin replaces its old wire
    const target = s.nodes.find((n) => n.id === c.target)
    const pin = target ? NODE_DEF_MAP[target.type]?.inputs.find((p) => p.id === c.targetHandle) : undefined
    const kept = pin && !pin.multi ? s.edges.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle)) : s.edges
    set({ edges: [...kept, { id: `e-${Date.now().toString(36)}${nodeSeq++}`, ...c }], dirty: true })
  },

  disconnect(ids) {
    if (!ids.length) return
    const s = get()
    s.checkpoint()
    const gone = new Set(ids)
    set({ edges: s.edges.filter((e) => !gone.has(e.id)), dirty: true })
  },

  toggleDisabled(ids) {
    const s = get()
    const list = ids ?? s.selected
    if (!list.length) return
    s.checkpoint()
    const turnOff = list.some((id) => !s.nodes.find((n) => n.id === id)?.disabled)
    set({ nodes: s.nodes.map((n) => (list.includes(n.id) ? { ...n, disabled: turnOff || undefined } : n)), dirty: true })
  },

  copy() {
    const s = get()
    const nodes = s.nodes.filter((n) => s.selected.includes(n.id) && !NODE_DEF_MAP[n.type]?.unique)
    const ids = new Set(nodes.map((n) => n.id))
    set({ clipboard: { nodes, edges: s.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) } })
  },

  paste(at) {
    const s = get()
    const c = s.clipboard
    if (!c || !c.nodes.length) return
    s.checkpoint()
    const minX = Math.min(...c.nodes.map((n) => n.position.x))
    const minY = Math.min(...c.nodes.map((n) => n.position.y))
    const map = new Map<string, string>()
    const nodes = c.nodes.map((n) => {
      const id = `${n.type}-${Date.now().toString(36)}${nodeSeq++}`
      map.set(n.id, id)
      return { ...n, id, position: { x: at.x + n.position.x - minX, y: at.y + n.position.y - minY }, data: { ...n.data } }
    })
    const edges = c.edges.map((e) => ({ ...e, id: `e-${Date.now().toString(36)}${nodeSeq++}`, source: map.get(e.source)!, target: map.get(e.target)! }))
    set({ nodes: [...s.nodes, ...nodes], edges: [...s.edges, ...edges], selected: nodes.map((n) => n.id), dirty: true })
  },

  duplicate() {
    const s = get()
    s.copy()
    const sel = get().clipboard?.nodes ?? []
    if (!sel.length) return
    s.paste({ x: Math.min(...sel.map((n) => n.position.x)) + 32, y: Math.min(...sel.map((n) => n.position.y)) + 32 })
  },

  async save() {
    const s = get()
    const p = s.project()
    if (!s.dir || !p || s.saving) return
    set({ saving: true })
    try {
      await window.api.saveProject(s.dir, p)
      // edits made while saving keep the project dirty
      const now = get().project()
      set({ dirty: now ? JSON.stringify(now) !== JSON.stringify(p) : false })
    } catch (e) {
      s.toast((e as Error).message, true)
    } finally {
      set({ saving: false })
    }
  },

  async commit(message) {
    const s = get()
    await s.save()
    if (!s.dir) return
    await window.api.gitCommit(s.dir, message)
    await s.refreshHistory()
  },

  async refreshHistory() {
    const dir = get().dir
    if (dir) set({ history: await window.api.gitLog(dir) })
  },

  async restore(hash) {
    const dir = get().dir
    if (!dir) return
    const project = await window.api.gitRestore(dir, hash)
    get().openProject(dir, project)
  },

  toast(text, error) {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts, { id, text, error }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), error ? 6000 : 3000)
  },

  appendLog: (line) => set((s) => ({ build: { ...s.build, logs: [...s.build.logs.slice(-1500), line] } })),
  setBuild: (patch) => set((s) => ({ build: { ...s.build, ...patch } }))
}))

// ---- derived state: diagnostics (debounced) + asset sizes + autosave -------------------------

let vTimer: ReturnType<typeof setTimeout> | undefined
let aTimer: ReturnType<typeof setTimeout> | undefined

useStore.subscribe((s, prev) => {
  if (!s.meta) return
  if (s.nodes !== prev.nodes || s.edges !== prev.edges || s.meta !== prev.meta || s.assetInfo !== prev.assetInfo) {
    clearTimeout(vTimer)
    vTimer = setTimeout(() => {
      const p = useStore.getState().project()
      if (p) useStore.setState({ diagnostics: validate(p, useStore.getState().assetInfo) })
    }, 150)
  }
  if (s.dir && s.nodes !== prev.nodes) {
    const missing = assetFiles(s.nodes).filter((f) => !(f in s.assetInfo))
    for (const f of missing) {
      // mark as loading so the loop does not repeat
      useStore.setState((x) => ({ assetInfo: { ...x.assetInfo, [f]: undefined as never } }))
      void window.api.assetInfo(s.dir, f).then((info) => useStore.setState((x) => ({ assetInfo: { ...x.assetInfo, [f]: info } })))
    }
  }
  if (s.dirty && (s.nodes !== prev.nodes || s.edges !== prev.edges || s.meta !== prev.meta || !prev.dirty)) {
    clearTimeout(aTimer)
    aTimer = setTimeout(() => void useStore.getState().save(), 1200)
  }
})

