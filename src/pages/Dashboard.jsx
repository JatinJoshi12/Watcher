import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../context'
import { getHomeCatalog, getRecentTrailers, getTitleDetails, tmdbConfigured } from '../lib/tmdb'
import CatalogCard from '../components/CatalogCard'
import TrailerCard from '../components/TrailerCard'
import AddToWatchlistDialog from '../components/AddToWatchlistDialog'
import Modal from '../components/Modal'
import { Icon } from '../components/Icon'
import TitlePreviewModal from '../components/TitlePreviewModal'

function PosterRail({ items, loading, onAdd, onView, existingListIds }) {
  if (loading) {
    return (
      <div className="watcher-rail-skeletons">
        {Array.from({ length: 8 }, (_, index) => <div className="watcher-card-skeleton" key={index} />)}
      </div>
    )
  }

  return (
    <div className="watcher-poster-rail">
      {items.map((item) => (
        <CatalogCard
          key={`${item.type}-${item.tmdb_id}`}
          item={item}
          onAdd={onAdd}
          onView={onView}
          inWatchlists={existingListIds(item)}
        />
      ))}
    </div>
  )
}

function SimpleSection({ title, items, loading, onAdd, onView, existingListIds }) {
  return (
    <section className="watcher-home-section">
      <div className="watcher-section-title-row">
        <h2>{title}</h2>
      </div>
      <PosterRail items={items} loading={loading} onAdd={onAdd} onView={onView} existingListIds={existingListIds} />
    </section>
  )
}

export default function Dashboard({ notify }) {
  const navigate = useNavigate()
  const { watchlists, items, addCatalogItem, createWatchlist } = useLibrary()
  const [catalog, setCatalog] = useState({
    upcomingMovies: [],
    upcomingSeries: [],
    topMovies: [],
    topSeries: [],
  })
  const [trailers, setTrailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addTarget, setAddTarget] = useState(null)
  const [adding, setAdding] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)

  useEffect(() => {
    if (!tmdbConfigured) {
      setLoading(false)
      return undefined
    }

    let active = true
    Promise.all([getHomeCatalog(), getRecentTrailers()])
      .then(([home, latestTrailers]) => {
        if (!active) return
        setCatalog(home)
        setTrailers(latestTrailers)
      })
      .catch((err) => active && setError(err.message || 'Unable To Load Home Content.'))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [])

  const existingListIds = (catalogItem) => items
    .filter((item) => item.tmdb_id === catalogItem.tmdb_id && item.type === catalogItem.type)
    .map((item) => item.watchlist_id)

  const openAdd = (item) => {
    if (!watchlists.length) {
      notify?.('Create A Watch List First.', 'error')
      navigate('/watchlists')
      return
    }
    setAddTarget(item)
  }

  const confirmAdd = async (selectedIds) => {
    if (!addTarget) return
    setAdding(true)
    try {
      let details = null
      try {
        details = await getTitleDetails(addTarget.tmdb_id, addTarget.type)
      } catch {
        details = null
      }
      const payload = {
        tmdb_id: addTarget.tmdb_id,
        type: addTarget.type,
        title: addTarget.title,
        year: addTarget.year,
        genre: details?.genre_names?.length ? details.genre_names : (addTarget.genre_names || []),
        poster_url: addTarget.poster_url || null,
        poster_path: addTarget.poster_path || null,
        backdrop_path: addTarget.backdrop_path || null,
        description: addTarget.overview || null,
        notes: null,
        status: 'unwatched',
        rating: null,
        platform: null,
        language: addTarget.original_language || null,
        favorite: false,
        progress: addTarget.type === 'series' ? 0 : null,
        runtime_minutes: details?.runtime_minutes ?? null,
        episode_runtime_minutes: details?.episode_runtime_minutes ?? null,
        total_episodes: details?.total_episodes ?? null,
        total_seasons: details?.total_seasons ?? null,
        watched_at: null,
      }
      const result = await addCatalogItem(selectedIds, payload)
      notify?.(
        result.created.length
          ? `Added To ${result.created.length} Watch List${result.created.length === 1 ? '' : 's'}.`
          : 'Already In The Selected Watch List.',
        result.created.length ? 'success' : 'info',
      )
      setAddTarget(null)
    } catch (err) {
      notify?.(err.message || 'Unable To Add Title.', 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="watcher-home-page">
      <section className="watcher-home-hero">
        <div className="watcher-hero-glow watcher-hero-glow-one" />
        <div className="watcher-hero-glow watcher-hero-glow-two" />
        <div className="watcher-hero-center">
          <h1>
            <span>WATCH</span>
            <span>DISCOVER</span>
            <span>REPEAT</span>
          </h1>
          <button
            className="watcher-hero-cta"
            onClick={() => navigate('/watchlists')}
          >
            <Icon name="list" size={19} />
            <span>Go To My Watch List</span>
            <Icon name="arrow" size={17} />
          </button>
        </div>
      </section>

      <div className="watcher-home-content page-container">
        <SimpleSection title="Upcoming Movies" items={catalog.upcomingMovies} loading={loading} onAdd={openAdd} onView={setViewTarget} existingListIds={existingListIds} />
        <SimpleSection title="Upcoming Web Series" items={catalog.upcomingSeries} loading={loading} onAdd={openAdd} onView={setViewTarget} existingListIds={existingListIds} />

        <section className="watcher-home-section">
          <div className="watcher-section-title-row">
            <h2>Latest Trailers And Teasers</h2>
          </div>
          {loading ? (
            <div className="watcher-trailer-skeletons">
              {Array.from({ length: 6 }, (_, index) => <div className="watcher-trailer-skeleton" key={index} />)}
            </div>
          ) : (
            <div className="watcher-trailer-rail">
              {trailers.map((item) => <TrailerCard key={`${item.type}-${item.tmdb_id}-${item.video_key}`} item={item} />)}
            </div>
          )}
        </section>

        <SimpleSection title="Top Movies" items={catalog.topMovies} loading={loading} onAdd={openAdd} onView={setViewTarget} existingListIds={existingListIds} />
        <SimpleSection title="Top Series" items={catalog.topSeries} loading={loading} onAdd={openAdd} onView={setViewTarget} existingListIds={existingListIds} />

        {error ? <div className="watcher-page-notice watcher-error">{error}</div> : null}
        {!tmdbConfigured ? <div className="watcher-page-notice">Add Your TMDB Token To Load Movies, Series, And Trailers.</div> : null}
      </div>

      <Modal open={Boolean(viewTarget)} onClose={() => setViewTarget(null)} title="Title Details" size="large" className="watcher-title-preview-modal">
        <TitlePreviewModal item={viewTarget} onClose={() => setViewTarget(null)} onAdd={(item) => { setViewTarget(null); openAdd(item) }} />
      </Modal>

      <Modal
        open={Boolean(addTarget)}
        onClose={() => adding ? null : setAddTarget(null)}
        title="Add To Watch Lists"
        size="large"
        className="watcher-picker-modal"
      >
        {addTarget ? (
          <AddToWatchlistDialog
            item={addTarget}
            watchlists={watchlists}
            existingListIds={existingListIds(addTarget)}
            onCreate={async (payload) => {
              const created = await createWatchlist(payload)
              notify?.(`Created ${created.name}.`, 'success')
              return created
            }}
            onConfirm={confirmAdd}
            onCancel={() => setAddTarget(null)}
            saving={adding}
          />
        ) : null}
      </Modal>
    </div>
  )
}
