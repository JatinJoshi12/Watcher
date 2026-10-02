import { useState, useEffect } from 'react'
import Poster from './Poster'
import { Icon } from './Icon'
import { formatGenre, labelType, titleCaseText } from '../lib/utils'

export default function WatchlistCard({ item, onDelete, onToggleStatus, onOpenDetails, onUpdateRank, busyId }) {
  const busy = busyId === item.id
  const statusLabel = item.status === 'watched' ? 'Watched' : 'Unwatched'
  const genreText = formatGenre(item.genre)

  const [rankVal, setRankVal] = useState(item.rank != null ? String(item.rank) : '')
  
  useEffect(() => {
    setRankVal(item.rank != null ? String(item.rank) : '')
  }, [item.rank])

  const handleRankSubmit = () => {
    if (rankVal === (item.rank != null ? String(item.rank) : '')) return
    if (onUpdateRank) onUpdateRank(item, rankVal)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  return (
    <article className="watcher-saved-card">
      <button className="watcher-saved-poster" onClick={() => onOpenDetails(item)} aria-label={`Open ${item.title}`} disabled={busy}>
        <Poster src={item.poster_url} alt={`${item.title} Poster`} title={item.title} />
        <span className={`watcher-status-badge ${item.status === 'watched' ? 'watched' : ''}`}>
          <span className="status-dot" />
          {statusLabel}
        </span>
      </button>

      <div className="watcher-saved-copy">
        <button className="watcher-saved-title" onClick={() => onOpenDetails(item)} disabled={busy}>{titleCaseText(item.title)}</button>
        <div className="watcher-saved-meta">
          <span>{labelType(item.type)}</span>
          {item.year ? <span>{item.year}</span> : null}
          <div className="watcher-ranking-control">
            <span>Rank</span>
            <input 
              type="number" 
              min="1" 
              value={rankVal}
              onChange={(e) => setRankVal(e.target.value)}
              onBlur={handleRankSubmit}
              onKeyDown={handleKeyDown}
              disabled={busy}
              placeholder="-" 
              className="watcher-rank-input"
              aria-label="Title Rank"
            />
          </div>
        </div>
        <div className="watcher-saved-genre">{genreText || 'Genre Not Added'}</div>
        <div className="watcher-saved-actions">
          <button className="watcher-status-action" onClick={() => onToggleStatus(item)} disabled={busy}>
            <Icon name="check" size={14} />
            {item.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
          </button>
          <button className="watcher-square-action watcher-view-action" onClick={() => onOpenDetails(item)} aria-label={`View ${item.title}`} disabled={busy}>
            <Icon name="eye" size={16} />
          </button>
          <button className="watcher-square-action danger" onClick={() => onDelete(item)} aria-label={`Delete ${item.title}`} disabled={busy}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </article>
  )
}
