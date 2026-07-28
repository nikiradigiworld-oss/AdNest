import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_UPDATED') window.location.reload()
  })
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
