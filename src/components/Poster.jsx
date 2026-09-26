import { useState } from 'react'

export default function Poster({ src, alt, title, className = '' }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`poster poster-fallback ${className}`} role="img" aria-label={`${title || 'Title'} poster placeholder`}>
        <span className="poster-fallback-mark">WM</span>
        <span>No poster</span>
      </div>
    )
  }
  return (
    <img className={`poster ${className}`} src={src} alt={alt || `${title} poster`} loading="lazy" onError={() => setFailed(true)} />
  )
}
