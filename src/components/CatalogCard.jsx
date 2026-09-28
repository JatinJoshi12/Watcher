import Poster from './Poster'
import { Icon } from './Icon'
import { titleCaseText } from '../lib/utils'

function yearLabel(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CatalogCard({ item, onAdd, onView, inWatchlists = [] }) {
  const typeLabel = item.type === 'series' ? 'Web Series' : 'Movie'

  return (
    <article className="watcher-catalog-card">
      <button className="watcher-catalog-poster" onClick={() => onView ? onView(item) : onAdd(item)} aria-label={onView ? `View ${item.title}` : `Add ${item.title} To A Watch List`}>
        <Poster src={item.poster_url} alt={`${item.title} Poster`} title={item.title} />
        <span className="watcher-poster-shine" />
        {item.release_date ? <span className="watcher-date-badge">{yearLabel(item.release_date)}</span> : null}
      </button>

      <div className="watcher-catalog-body">
        <h3 title={item.title}>{titleCaseText(item.title)}</h3>
        <div className="watcher-catalog-meta">
          <span>{typeLabel}</span>
          {item.year ? <span>{item.year}</span> : null}
        </div>
        {item.genre_names?.length ? <div className="watcher-catalog-genres">{item.genre_names.slice(0, 2).join(' · ')}</div> : null}

        <div className="watcher-catalog-footer">
          <button className="watcher-card-add" onClick={() => onAdd(item)}>
            <Icon name="plus" size={13} />
            Add
          </button>
          {onView ? (
            <button className="watcher-card-view" onClick={() => onView(item)} aria-label={`View ${item.title}`}>
              <Icon name="eye" size={14} />
              View
            </button>
          ) : null}
          {inWatchlists.length ? (
            <span className="watcher-saved-chip" title="Saved" aria-label="Saved">
              <Icon name="check" size={16} strokeWidth={2.4} />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
