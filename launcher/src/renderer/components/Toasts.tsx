import { useStore } from '../store'

export function Toasts(): React.JSX.Element {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.error ? ' err' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
