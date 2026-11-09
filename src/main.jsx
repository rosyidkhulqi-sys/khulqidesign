import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

// After a new deploy, a tab opened earlier still asks for the old file of a
// lazily loaded page (Admin, Create...), which no longer exists, and the page
// stays blank. Vite reports it as "vite:preloadError": load the new version,
// at most once a minute so a real outage can't loop.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('kd-reloaded-at')) || 0
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('kd-reloaded-at', String(Date.now()))
  } catch {
    /* no storage: reload anyway, once per page view */
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <App />
)