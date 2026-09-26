import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './theme.css'
import './premium-v2.css'

const savedTheme = localStorage.getItem('watchlist_theme') || 'dark'
document.documentElement.dataset.theme = savedTheme
document.documentElement.style.colorScheme = savedTheme

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
