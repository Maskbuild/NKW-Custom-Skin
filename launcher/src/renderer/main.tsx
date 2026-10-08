import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './theme.css'
import './app.css'
import { App } from './App'
import { ModBrowser } from './components/ModBrowser'

createRoot(document.getElementById('root')!).render(location.hash === '#modrinth' ? <ModBrowser /> : <App />)
