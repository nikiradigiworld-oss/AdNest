import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  // Unregister any old service workers, then register fresh
  navigator.serviceWorker.getRegistrations().then(regs => {
    const stale = regs.filter(r => r.active?.scriptURL && !r.active.scriptURL.includes('sw.js'))
    stale.forEach(r => r.unregister())
  })
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

export function showToast(msg, type = 'info') {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className = 'show' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '')
  clearTimeout(el._t)
  el._t = setTimeout(() => { el.className = '' }, 3000)
}

window.showToast = showToast

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
