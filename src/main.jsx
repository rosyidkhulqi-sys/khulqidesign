import { createRoot } from 'react-dom/client'
import './styles/fonts.js'
import './styles/index.css'
import App from './App.jsx'

// Every picture is marked once it has arrived (or failed), so library cards
// can shimmer until then on every page, not only on the first load
// (index.css: [data-loaded]). Load events don't bubble; the capture phase sees them.
const markLoaded = (event) => {
  if (event.target instanceof HTMLImageElement) event.target.setAttribute('data-loaded', '')
}
document.addEventListener('load', markLoaded, true)
document.addEventListener('error', markLoaded, true)

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