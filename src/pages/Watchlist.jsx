import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLibrary } from '../context'
import WatchlistGrid from '../components/WatchlistGrid'
import CatalogCard from '../components/CatalogCard'
import Modal from '../components/Modal'
import RandomPicker from './RandomPicker'
import { Icon } from '../components/Icon'
import TitlePreviewModal from '../components/TitlePreviewModal'
import { filterItems, sortItems, getWatchedAtPatch, titleCaseText } from '../lib/utils'
import { getGenres, searchCatalog, getTitleDetails } from '../lib/tmdb'

function PlaylistDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!event.target.closest('.watcher-award-filter')) setOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={`watcher-award-filter ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="watcher-award-filter-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{value.label}</span>
        <Icon name="chevron" size={15} />
      </button>
      {open ? (
        <div className="watcher-award-filter-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value.value === option.value}
              className={value.value === option.value ? 'active' : ''}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span>{option.label}</span>
              {value.value === option.value ? <Icon name="check" size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'rank_asc', label: 'Sort by Ranking' },
  { value: 'created_desc', label: 'Recently Added' },
  { value: 'updated_desc', label: 'Recently Updated' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'title_desc', label: 'Title Z-A' },
  { value: 'year_desc', label: 'Year Newest' },
  { value: 'year_asc', label: 'Year Oldest' },
  { value: 'rating_desc', label: 'Rating Highest' },
]

export default function Watchlist({ onDelete, notify }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { watchlists, items, updateItem, addCatalogItem } = useLibrary()
  const list = watchlists.find((entry) => entry.id === id)
  const listItems = useMemo(() => items.filter((item) => item.watchlist_id === id), [items, id])

  const [status, setStatus] = useState('')
  const [genre, setGenre] = useState('')
  const [sortOption, setSortOption] = useState('created_desc')
  const [findQuery, setFindQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const [genreNames, setGenreNames] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [randomPickOpen, setRandomPickOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)

  const filters = useMemo(() => ({
    search: '',
    type: '',
    status,
    genre,
    year: '',
    platform: '',
    language: '',
    favorite: false,
  }), [status, genre])

  const results = useMemo(
    () => sortItems(filterItems(listItems, filters), sortOption),
    [listItems, filters, sortOption],
  )

  useEffect(() => {
    let active = true
    getGenres()
      .then((data) => active && setGenreNames(data.names || []))
      .catch(() => active && setGenreNames(['Action', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const query = findQuery.trim()
    if (!query) {
      setSearchResults([])
      setSearchLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await searchCatalog(query, { type: 'all', page: 1 })
        if (!active) return
        const existing = new Set(listItems.map((item) => `${item.type}-${item.tmdb_id}`))
        setSearchResults((data.results || []).filter((item) => !existing.has(`${item.type}-${item.tmdb_id}`)).slice(0, 8))
      } catch (error) {
        if (active) notify?.(error.message || 'Unable To Search Titles.', 'error')
      } finally {
        if (active) setSearchLoading(false)
      }
    }, 280)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [findQuery, listItems, notify])

  if (!list) {
    return (
      <div className="watcher-not-found page-container">
        <div className="watcher-kicker">WATCH LIST</div>
        <h1>Watch List Not Found.</h1>
        <button className="watcher-primary-button" onClick={() => navigate('/watchlists')}>Back To My Watch List</button>
      </div>
    )
  }

  const toggleStatus = async (item) => {
    setBusyId(item.id)
    const nextStatus = item.status === 'watched' ? 'unwatched' : 'watched'
    try {
      await updateItem(item.id, { status: nextStatus, ...getWatchedAtPatch(item, nextStatus) })
      notify?.(nextStatus === 'watched' ? 'Marked As Watched.' : 'Marked As Unwatched.', 'success')
    } catch (error) {
      notify?.(error.message || 'Unable To Update Status.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const addSearchResult = async (item) => {
    setAddingId(`${item.type}-${item.tmdb_id}`)
    try {
      let maxRank = 0;
      for (const i of listItems) {
        if (i.rank != null && i.rank > maxRank) maxRank = i.rank;
      }
      const nextRank = maxRank + 1;

      let details = null
      try { details = await getTitleDetails(item.tmdb_id, item.type) } catch { details = null }
      const result = await addCatalogItem([id], {
        tmdb_id: item.tmdb_id,
        type: item.type,
        title: item.title,
        year: item.year,
        genre: details?.genre_names?.length ? details.genre_names : (item.genre_names || []),
        poster_url: item.poster_url || null,
        poster_path: item.poster_path || null,
        backdrop_path: item.backdrop_path || null,
        description: item.overview || null,
        notes: null,
        status: 'unwatched',
        rating: null,
        platform: null,
        language: item.original_language || null,
        favorite: false,
        progress: item.type === 'series' ? 0 : null,
        runtime_minutes: details?.runtime_minutes ?? null,
        episode_runtime_minutes: details?.episode_runtime_minutes ?? null,
        total_episodes: details?.total_episodes ?? null,
        total_seasons: details?.total_seasons ?? null,
        watched_at: null,
        rank: nextRank,
      })
      notify?.(result.created.length ? `Added To ${titleCaseText(list.name)}.` : `Already In ${titleCaseText(list.name)}.`, result.created.length ? 'success' : 'info')
      setSearchResults((current) => current.filter((entry) => `${entry.type}-${entry.tmdb_id}` !== `${item.type}-${item.tmdb_id}`))
    } catch (error) {
      notify?.(error.message || 'Unable To Add Title.', 'error')
    } finally {
      setAddingId(null)
    }
  }

  const updateRank = async (item, newRankStr) => {
    let newRank = newRankStr ? parseInt(newRankStr, 10) : null;
    if (newRank !== null && (isNaN(newRank) || newRank < 1)) newRank = null;
    if (newRank === item.rank) return;
    
    setBusyId(item.id)
    try {
      const otherRanked = listItems.filter(i => i.rank != null && i.id !== item.id).sort((a, b) => a.rank - b.rank);
      
      if (newRank !== null) {
         const maxPossibleRank = otherRanked.length + 1;
         if (newRank > maxPossibleRank) newRank = maxPossibleRank;
      }
      
      const updates = [];
      updates.push({ id: item.id, rank: newRank });
      
      let currentRank = 1;
      for (const i of otherRanked) {
         if (currentRank === newRank) {
            currentRank++;
         }
         if (i.rank !== currentRank) {
            updates.push({ id: i.id, rank: currentRank });
         }
         currentRank++;
      }

      for (const u of updates) {
         await updateItem(u.id, { rank: u.rank });
      }
      
      notify?.('Ranking Updated.', 'success')
    } catch (error) {
      notify?.(error.message || 'Unable To Update Ranking.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="watcher-watchlist-page">
      <div className="watcher-watchlist-hero">
        <div className="page-container watcher-watchlist-hero-inner">
          <button className="watcher-back-button" onClick={() => navigate('/watchlists')}>
            <Icon name="back" size={16} />
            My Watch List
          </button>

          <div className="watcher-watchlist-hero-copy">
            <div className="watcher-kicker">YOUR COLLECTION</div>
            <h1>{titleCaseText(list.name)}</h1>
            <p>{titleCaseText(list.description || 'A Collection Built Around The Stories You Want To Keep Close.')}</p>
          </div>

          <div className="watcher-watchlist-hero-actions">
            <button className="watcher-secondary-button watcher-random-pick-button" onClick={() => setRandomPickOpen(true)}>
              <Icon name="refresh" size={15} />
              Random Pick
            </button>
            <div className="watcher-watchlist-count">
              <strong>{listItems.length}</strong>
              <span>{listItems.length === 1 ? 'Title' : 'Titles'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container watcher-watchlist-content">
        <section className="watcher-find-section">
          <div className="watcher-find-bar">
            <Icon name="search" size={21} />
            <input value={findQuery} onChange={(event) => setFindQuery(event.target.value)} placeholder="Find Title" aria-label="Find title in this Watch List" />
            <button type="button" className="watcher-search-button" onClick={() => document.querySelector('.watcher-find-bar input')?.focus()} aria-label="Search titles" title="Search titles">
              <Icon name="search" size={17} />
              Find Title
            </button>
          </div>

          {findQuery.trim() ? (
            <div className="watcher-inline-search-panel">
              <div className="watcher-inline-search-heading">
                <div>
                  <span className="watcher-kicker">SEARCHING THIS WATCH LIST</span>
                  <h2>{searchLoading ? 'Finding Titles…' : `Results For “${findQuery.trim()}”`}</h2>
                </div>
                <span>{searchResults.length} Available</span>
              </div>

              {searchLoading ? (
                <div className="watcher-inline-search-loading"><span /><span /><span /><span /></div>
              ) : searchResults.length ? (
                <div className="watcher-inline-search-grid">
                  {searchResults.map((item) => <CatalogCard key={`${item.type}-${item.tmdb_id}`} item={item} onAdd={addSearchResult} inWatchlists={[]} />)}
                </div>
              ) : (
                <div className="watcher-inline-empty">No New Titles Found. Try Another Name.</div>
              )}
            </div>
          ) : null}
        </section>

        <section className="watcher-watchlist-toolbar">
          <div className="watcher-filter-group">
            <span className="watcher-filter-heading"><Icon name="filter" size={15} /> Status</span>
            <div className="watcher-segmented-control">
              {[['', 'All'], ['unwatched', 'Unwatched'], ['watched', 'Watched']].map(([value, label]) => <button key={value} type="button" className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}
            </div>
          </div>
          <div className="watcher-filter-group">
            <span className="watcher-filter-heading"><Icon name="grid" size={15} /> Genre</span>
            <PlaylistDropdown
              label="Genre"
              value={{ value: genre, label: genre || 'All Genres' }}
              options={[{ value: '', label: 'All Genres' }, ...genreNames.map((name) => ({ value: name, label: name }))]}
              onChange={setGenre}
            />
          </div>
          <div className="watcher-filter-group">
            <span className="watcher-filter-heading"><Icon name="sort" size={15} /> Sort</span>
            <PlaylistDropdown
              label="Sort"
              value={SORT_OPTIONS.find((option) => option.value === sortOption) || SORT_OPTIONS[0]}
              options={SORT_OPTIONS}
              onChange={setSortOption}
            />
          </div>
        </section>

        <div className="watcher-results-header">
          <div>
            <span className="watcher-kicker">YOUR TITLES</span>
            <h2>{results.length} {results.length === 1 ? 'Title' : 'Titles'}</h2>
          </div>
          <span className="watcher-results-note">Keep The Filters Simple. Keep The Stories Good.</span>
        </div>

        {results.length ? (
          <WatchlistGrid items={results} onDelete={onDelete} onToggleStatus={toggleStatus} onToggleFavorite={() => {}} onOpenDetails={(item) => setViewTarget(item)} onUpdateRank={updateRank} busyId={busyId || addingId} />
        ) : (
          <div className="watcher-watchlist-empty">
            <Icon name="play" size={24} />
            <h2>{listItems.length ? 'No Titles Match These Filters.' : 'This Watch List Is Empty.'}</h2>
            <p>{listItems.length ? 'Change Status Or Genre To See More.' : 'Use Find Title Above To Add A Movie Or Series Without Leaving This Page.'}</p>
            {!listItems.length ? <button className="watcher-primary-button" onClick={() => document.querySelector('.watcher-find-bar input')?.focus()}><Icon name="search" size={15} /> Find Title</button> : null}
          </div>
        )}
      </div>

      <Modal open={Boolean(viewTarget)} onClose={() => setViewTarget(null)} title="Title Details" size="large" className="watcher-title-preview-modal">
        <TitlePreviewModal item={viewTarget} onClose={() => setViewTarget(null)} />
      </Modal>

      <Modal open={randomPickOpen} onClose={() => setRandomPickOpen(false)} title="Random Pick" size="large" className="watcher-random-pick-modal">
        {randomPickOpen ? (
          <RandomPicker
            embedded
            title="Random Pick"
            sourceItems={listItems}
            onView={(item) => {
              setRandomPickOpen(false)
              setViewTarget(item)
            }}
          />
        ) : null}
      </Modal>
    </div>
  )
}
