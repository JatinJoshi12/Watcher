import Poster from './Poster'
import { Icon } from './Icon'

function formatDate(value) {
  if (!value) return 'Recently Released'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently Released'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function TrailerCard({ item }) {
  return (
    <a className="watcher-trailer-card" href={item.video_url} target="_blank" rel="noreferrer">
      <div className="watcher-trailer-poster">
        <Poster src={item.backdrop_url || item.poster_url} alt={`${item.title} Trailer`} title={item.title} />
        <span className="watcher-trailer-overlay" />
        <span className="watcher-trailer-play"><Icon name="play" size={20} /></span>
        <span className="watcher-trailer-type">{item.video_type}</span>
      </div>
      <div className="watcher-trailer-copy">
        <h3>{item.title}</h3>
        <div className="watcher-trailer-meta-row">
          <span>{item.video_name || `${item.title} ${item.video_type}`}</span>
        </div>
        <span>{formatDate(item.video_published_at)}</span>
      </div>
    </a>
  )
}
