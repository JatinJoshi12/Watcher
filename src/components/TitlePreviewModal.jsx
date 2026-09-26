import { Icon } from './Icon'
import { titleCaseText } from '../lib/utils'

export default function TitlePreviewModal({ item, onClose, onAdd }) {
  if (!item) return null

  const typeLabel = item.type === 'series' ? 'Web Series' : 'Movie'
  const genres = Array.isArray(item.genre_names) && item.genre_names.length
    ? item.genre_names
    : (Array.isArray(item.genre) ? item.genre : [])
  const description = item.overview || item.description || 'No Description Is Available For This Title Yet.'
  const backdrop = item.backdrop_url || (item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '')
  const background = backdrop || item.poster_url || '/modal-background.png'

  return (
    <div
      className="watcher-title-preview"
      style={{ '--watcher-preview-bg': `url("${background}")` }}
    >
      <div className="watcher-title-preview-art">
        <div className="watcher-title-preview-poster">
          {item.poster_url ? (
            <img src={item.poster_url} alt={`${item.title} Poster`} />
          ) : (
            <Icon name="play" size={28} />
          )}
        </div>
      </div>

      <div className="watcher-title-preview-copy">
        <span className="watcher-kicker">{typeLabel.toUpperCase()}</span>
        <h2>{titleCaseText(item.title)}</h2>

        <div className="watcher-title-preview-meta">
          {item.year ? <span className="watcher-preview-year">{item.year}</span> : null}
        </div>

        {genres.length ? (
          <div className="watcher-detail-genres watcher-title-preview-genres">
            {genres.slice(0, 6).map((genre) => <span key={genre}>{titleCaseText(genre)}</span>)}
          </div>
        ) : null}

        <section className="watcher-story-section watcher-title-preview-story">
          <span className="watcher-kicker">STORY</span>
          <p>{titleCaseText(description)}</p>
        </section>

        <div className="watcher-title-preview-actions">
          {onAdd ? (
            <button className="watcher-primary-button watcher-preview-add-button" onClick={() => onAdd(item)}>
              <Icon name="plus" size={16} />
              Add To Watch List
            </button>
          ) : null}
          <button className="watcher-secondary-button watcher-preview-close-button" onClick={onClose}>
            <Icon name="close" size={16} />
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
