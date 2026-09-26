import { useEffect } from 'react'
import { Icon } from './Icon'

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null
  return (
    <div className={`toast toast-${toast.type || 'info'}`} role="status">
      <span>{toast.message}</span>
      <button className="icon-button subtle" onClick={onClose} aria-label="Close notification"><Icon name="close" size={16} /></button>
    </div>
  )
}
