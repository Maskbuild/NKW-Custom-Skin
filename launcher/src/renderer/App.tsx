import { useEffect } from 'react'
import { useStore } from './store'
import { useLang } from './i18n'
import { Home } from './pages/Home'
import Workspace from './pages/Workspace'
import { Toasts } from './components/Toasts'

export function App(): React.JSX.Element | null {
  const settings = useStore((s) => s.settings)
  const dir = useStore((s) => s.dir)

  useEffect(() => {
    void window.api.settings().then((s) => {
      useStore.getState().setSettings(s)
      useLang.setState({ lang: s.lang })
    })
  }, [])

  // never lose edits: flush on close
  useEffect(() => {
    const h = (): void => { if (useStore.getState().dirty) void useStore.getState().save() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  if (!settings) return null
  return (
    <>
      {dir ? <Workspace /> : <Home />}
      <Toasts />
    </>
  )
}
