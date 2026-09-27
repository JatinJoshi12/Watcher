import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLibrary } from '../context'
import Poster from '../components/Poster'
import ConfirmDialog from '../components/ConfirmDialog'
import StreamSourcePanel from '../components/StreamSourcePanel'
import { Icon } from '../components/Icon'
import { titleCaseText } from '../lib/utils'

export default function Detail({ notify }) {
  const { watchlistId, itemId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { watchlists, items, deleteItem, updateItem } = useLibrary()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const autoPlay = Boolean(location.state?.watcherAutoPlay)

  const list = useMemo(() => watchlists.find((entry) => entry.id === watchlistId), [watchlists, watchlistId])
  const item = useMemo(() => items.find((entry) => entry.id === itemId), [items, itemId])

  if (!list || !item) {
    return (
      <div className="watcher-not-found page-container">
        <div className="watcher-kicker">TITLE NOT FOUND</div>
        <h1>This Title Is No Longer Here.</h1>
        <button className="watcher-primary-button" onClick={() => navigate(`/watchlists/${watchlistId}`)}>Back To Watch List</button>
      </div>
    )
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteItem(item.id)
      notify?.('Title Deleted.', 'success')
      setDeleteOpen(false)
      navigate(`/watchlists/${watchlistId}`)
    } catch (error) {
      notify?.(error.message || 'Unable To Delete Title.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const genres = Array.isArray(item.genre) ? item.genre : []
  const backdrop = item.backdrop_url || (item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '')

  return (
    <div className="watcher-detail-page" style={backdrop ? { '--watcher-detail-image': `url(${backdrop})` } : undefined}>
      <div className="page-container watcher-detail-inner">
        <button className="watcher-back-button" onClick={() => navigate(`/watchlists/${watchlistId}`)}>
          <Icon name="back" size={16} /> {titleCaseText(list.name)}
        </button>

        <section className="watcher-detail-panel">
          <div className="watcher-detail-poster">
            <Poster src={item.poster_url} alt={`${item.title} Poster`} title={item.title} />
          </div>

          <div className="watcher-detail-content">
            <span className="watcher-kicker">{item.type === 'series' ? 'WEB SERIES' : 'MOVIE'}</span>
            <h1>{titleCaseText(item.title)}</h1>

            <div className="watcher-detail-badges">
              {item.year ? <span>{item.year}</span> : null}
              <span className={item.status === 'watched' ? 'status-active' : ''}>{item.status === 'watched' ? 'Watched' : 'Unwatched'}</span>
            </div>

            {genres.length ? <div className="watcher-detail-genres">{genres.map((genre) => <span key={genre}>{genre}</span>)}</div> : null}

            <section className="watcher-story-section">
              <span className="watcher-kicker">STORY</span>
              <p>{titleCaseText(item.description || 'No Description Added.')}</p>
            </section>

            <StreamSourcePanel item={item} updateItem={updateItem} notify={notify} autoPlay={autoPlay} />

            <div className="watcher-detail-actions">
              <button className="watcher-danger-button" onClick={() => setDeleteOpen(true)} disabled={busy}>
                <Icon name="trash" size={15} /> Delete Title
              </button>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${item.title}?`}
        message="This Removes The Title From This Watch List."
        onConfirm={remove}
        onCancel={() => (busy ? null : setDeleteOpen(false))}
        loading={busy}
      />
    </div>
  )
}
