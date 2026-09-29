import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useLibrary } from '../context'
import { getGenres, searchCatalog, discoverCatalog, getTitleDetails } from '../lib/tmdb'
import { searchProfiles, getPublicStats } from '../lib/communityRepository'
import CatalogCard from '../components/CatalogCard'
import AddToWatchlistDialog from '../components/AddToWatchlistDialog'
import Modal from '../components/Modal'
import { Icon } from '../components/Icon'
import TitlePreviewModal from '../components/TitlePreviewModal'
import { titleCaseText } from '../lib/utils'

function dedupe(items) {
  return [...new Map(items.map((item) => [`${item.type}-${item.tmdb_id}`, item])).values()]
}

function UserResult({ profile, stats, onOpen }) {
  const displayName = profile.display_name || profile.username || 'Watcher User'
  return (
    <button className="watcher-discover-user-result" type="button" onClick={() => onOpen(profile.user_id)}>
      {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span className="watcher-user-fallback">{displayName.charAt(0).toUpperCase()}</span>}
      <span>
        <strong>{displayName}</strong>
        <small>@{profile.username}</small>
      </span>
      <em>{stats?.total_titles_watched ?? 0} watched</em>
      <Icon name="arrow" size={15} />
    </button>
  )
}

export default function Discover({ notify }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const initialQuery = params.get('query') || ''
  const [query, setQuery] = useState(initialQuery)
  const [type, setType] = useState('movie')
  const [genreName, setGenreName] = useState('')
  const [genreMaps, setGenreMaps] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [searchPage, setSearchPage] = useState(1)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [movies, setMovies] = useState([])
  const [series, setSeries] = useState([])
  const [moviePage, setMoviePage] = useState(1)
  const [seriesPage, setSeriesPage] = useState(1)
  const [movieHasMore, setMovieHasMore] = useState(true)
  const [seriesHasMore, setSeriesHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState({ movie: false, series: false, search: false })
  const [userResults, setUserResults] = useState([])
  const [userStats, setUserStats] = useState({})
  const [userLoading, setUserLoading] = useState(false)
  const [error, setError] = useState('')
  const [addTarget, setAddTarget] = useState(null)
  const [adding, setAdding] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const { watchlists, items, createWatchlist, addCatalogItem } = useLibrary()

  const activeSearch = query.trim().length > 0
  const searchingUsers = type === 'users'

  useEffect(() => {
    let active = true
    getGenres().then((data) => active && setGenreMaps(data)).catch(() => null)
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const clean = query.trim()
      if (clean) setParams({ query: clean }, { replace: true })
      else setParams({}, { replace: true })
    }, 160)
    return () => window.clearTimeout(timer)
  }, [query, setParams])

  const runCatalogSearch = async (page = 1, append = false) => {
    const clean = query.trim()
    if (!clean || searchingUsers) return
    setError('')
    if (append) setLoadingMore((state) => ({ ...state, search: true }))
    else setLoading(true)
    try {
      const data = await searchCatalog(clean, { type, page })
      setSearchResults((current) => append ? dedupe([...current, ...(data.results || [])]) : dedupe(data.results || []))
      setSearchPage(data.page || page)
      setSearchHasMore((data.page || page) < (data.total_pages || 1))
    } catch (err) {
      setError(err.message || 'Unable To Search The Catalog.')
    } finally {
      setLoading(false)
      setLoadingMore((state) => ({ ...state, search: false }))
    }
  }

  const runUserSearch = async () => {
    const clean = query.trim()
    if (!clean || !searchingUsers) return
    setUserLoading(true)
    setError('')
    try {
      const found = await searchProfiles(clean)
      setUserResults(found)
      const nextStats = {}
      await Promise.all(found.slice(0, 8).map(async (profile) => {
        try { nextStats[profile.user_id] = await getPublicStats(profile.user_id) } catch { nextStats[profile.user_id] = null }
      }))
      setUserStats(nextStats)
    } catch (err) {
      setError(err.message || 'Unable To Search Watchers.')
      setUserResults([])
    } finally {
      setUserLoading(false)
    }
  }

  const loadBrowse = async (kind, page = 1, append = false) => {
    if (searchingUsers) return
    setError('')
    setLoadingMore((state) => ({ ...state, [kind]: append }))
    if (!append) setLoading(true)
    try {
      const specificGenreId = kind === 'movie'
        ? genreMaps?.movieByName.get(genreName) || ''
        : genreMaps?.seriesByName.get(genreName) || ''
      const data = await discoverCatalog({ type: kind, genreId: specificGenreId, page })
      const incoming = data.results || []
      if (kind === 'movie') {
        setMovies((current) => append ? dedupe([...current, ...incoming]) : incoming)
        setMoviePage(data.page || page)
        setMovieHasMore((data.page || page) < (data.total_pages || 1))
      } else {
        setSeries((current) => append ? dedupe([...current, ...incoming]) : incoming)
        setSeriesPage(data.page || page)
        setSeriesHasMore((data.page || page) < (data.total_pages || 1))
      }
    } catch (err) {
      setError(err.message || 'Unable To Load The Catalog.')
    } finally {
      setLoading(false)
      setLoadingMore((state) => ({ ...state, [kind]: false }))
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeSearch) {
        if (searchingUsers) runUserSearch()
        else runCatalogSearch(1, false)
        return
      }

      if (searchingUsers || !genreMaps) return

      setSearchResults([])
      setUserResults([])
      setMovies([])
      setSeries([])
      setMoviePage(1)
      setSeriesPage(1)
      setMovieHasMore(true)
      setSeriesHasMore(true)

      if (type === 'movie') loadBrowse('movie', 1, false)
      if (type === 'series') loadBrowse('series', 1, false)
    }, activeSearch ? 300 : 100)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, type, genreName, genreMaps])

  useEffect(() => {
    if (initialQuery !== query.trim()) setQuery(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  const searchMovies = searchResults.filter((item) => item.type === 'movie')
  const searchSeries = searchResults.filter((item) => item.type === 'series')
  const movieResults = activeSearch ? searchMovies : movies
  const seriesResults = activeSearch ? searchSeries : series

  const userItemMap = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const key = `${item.type}-${item.tmdb_id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item.watchlist_id)
    }
    return map
  }, [items])

  const existingListIds = (catalogItem) => {
    return userItemMap.get(`${catalogItem.type}-${catalogItem.tmdb_id}`) || []
  }

  const openAdd = (item) => {
    if (!watchlists.length) {
      notify?.('Create A Watch List Before Saving Titles.', 'error')
      return
    }
    setAddTarget(item)
  }

  const confirmAdd = async (selectedIds) => {
    if (!addTarget) return
    setAdding(true)
    try {
      let details = null
      try { details = await getTitleDetails(addTarget.tmdb_id, addTarget.type) } catch { details = null }
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
      notify?.(result.created.length ? `Added To ${result.created.length} Watch List${result.created.length === 1 ? '' : 's'}.` : 'Already In The Selected Watch List.', result.created.length ? 'success' : 'info')
      setAddTarget(null)
    } catch (err) {
      notify?.(err.message || 'Unable To Add Title.', 'error')
    } finally {
      setAdding(false)
    }
  }

  const setSearchMode = (next) => {
    setType(next)
    if (next === 'users') setGenreName('')
  }

  return (
    <div className="watcher-discover-page">
      <div className="page-container watcher-discover-container">
        <section className="watcher-discover-hero">
          <span className="watcher-kicker">DISCOVER</span>
          <h1 className="watcher-discover-title">Your Next Obsession Is One Search Away.</h1>

          <div className="watcher-discover-search">
            <Icon name="search" size={25} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Movies, Web Series Or Users..." aria-label="Search Movies, Web Series Or Users" autoFocus />
            {query ? <button className="watcher-clear-search" type="button" onClick={() => setQuery('')} aria-label="Clear Search"><Icon name="close" size={17} /></button> : null}
            <button className="watcher-search-main-button" type="button" onClick={() => searchingUsers ? runUserSearch() : runCatalogSearch(1, false)}>Search<Icon name="arrow" size={15} /></button>
          </div>

          <div className="watcher-discover-search-mode-bar">
            {[
              ['movie', 'Movies'],
              ['series', 'Web Series'],
              ['users', 'Users'],
            ].map(([value, label]) => (
              <button key={value} type="button" className={type === value ? 'active' : ''} onClick={() => setSearchMode(value)}>{label}</button>
            ))}
          </div>

          {!searchingUsers ? (
            <div className="watcher-discover-genres">
              {(genreMaps?.names || ['Action', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']).slice(0, 14).map((name) => (
                <button key={name} className={genreName === name ? 'active' : ''} onClick={() => { setGenreName((current) => current === name ? '' : name); setQuery('') }}>{name}</button>
              ))}
            </div>
          ) : null}
        </section>

        {error ? <div className="watcher-page-notice watcher-error">{error}</div> : null}

        {searchingUsers ? (
          <section className="watcher-discover-user-section">
            <div className="watcher-discover-section-heading">
              <div><span className="watcher-kicker">WATCHER USERS</span><h2>{query.trim() ? `Users Matching ${titleCaseText(query)}` : 'Search Watchers'}</h2></div>
              <span>{userLoading ? 'Searching…' : `${userResults.length} Found`}</span>
            </div>
            {!query.trim() ? (
              <div className="watcher-discover-empty">Search by username or display name.</div>
            ) : userResults.length ? (
              <div className="watcher-discover-user-results">
                {userResults.map((profile) => <UserResult key={profile.user_id} profile={profile} stats={userStats[profile.user_id]} onOpen={(id) => navigate(`/users/${id}`)} />)}
              </div>
            ) : !userLoading ? (
              <div className="watcher-discover-empty">No Watcher users matched this search.</div>
            ) : null}
          </section>
        ) : (
          <>
            {(type === 'movie' || (activeSearch && searchMovies.length)) ? (
              <section className="watcher-discover-section">
                <div className="watcher-discover-section-heading">
                  <div><span className="watcher-kicker">MOVIES</span><h2 className="watcher-discover-result-title">{activeSearch ? `Movie Results For ${titleCaseText(query)}` : genreName ? `${titleCaseText(genreName)} Movies` : 'Explore Movies'}</h2></div>
                  <span>{movieResults.length} Shown</span>
                </div>
                {loading && !movieResults.length ? (
                  <div className="watcher-discover-grid">{Array.from({ length: 10 }, (_, index) => <div className="watcher-catalog-skeleton" key={index} />)}</div>
                ) : movieResults.length ? (
                  <div className="watcher-discover-grid">{movieResults.map((item) => <CatalogCard key={`${item.type}-${item.tmdb_id}`} item={item} onAdd={openAdd} onView={setViewTarget} inWatchlists={existingListIds(item)} />)}</div>
                ) : (
                  <div className="watcher-discover-empty">{loading ? 'Searching…' : 'No Movies Found For This Search.'}</div>
                )}
                {((!activeSearch && movieHasMore) || (activeSearch && type === 'movie' && searchHasMore)) ? (
                  <button className="watcher-show-more" disabled={activeSearch ? loadingMore.search : loadingMore.movie} onClick={() => activeSearch ? runCatalogSearch(searchPage + 1, true) : loadBrowse('movie', moviePage + 1, true)}>
                    {activeSearch ? (loadingMore.search ? 'Loading…' : 'Show More') : (loadingMore.movie ? 'Loading…' : 'Show More')}<Icon name="arrow" size={16} />
                  </button>
                ) : null}
              </section>
            ) : null}

            {(type === 'series' || (activeSearch && searchSeries.length)) ? (
              <section className="watcher-discover-section">
                <div className="watcher-discover-section-heading">
                  <div><span className="watcher-kicker">WEB SERIES</span><h2 className="watcher-discover-result-title">{activeSearch ? `Series Results For ${titleCaseText(query)}` : genreName ? `${titleCaseText(genreName)} Web Series` : 'Explore Web Series'}</h2></div>
                  <span>{seriesResults.length} Shown</span>
                </div>
                {loading && !seriesResults.length ? (
                  <div className="watcher-discover-grid">{Array.from({ length: 10 }, (_, index) => <div className="watcher-catalog-skeleton" key={index} />)}</div>
                ) : seriesResults.length ? (
                  <div className="watcher-discover-grid">{seriesResults.map((item) => <CatalogCard key={`${item.type}-${item.tmdb_id}`} item={item} onAdd={openAdd} onView={setViewTarget} inWatchlists={existingListIds(item)} />)}</div>
                ) : (
                  <div className="watcher-discover-empty">{loading ? 'Searching…' : 'No Web Series Found For This Search.'}</div>
                )}
                {((!activeSearch && seriesHasMore) || (activeSearch && type === 'series' && searchHasMore)) ? (
                  <button className="watcher-show-more" disabled={activeSearch ? loadingMore.search : loadingMore.series} onClick={() => activeSearch ? runCatalogSearch(searchPage + 1, true) : loadBrowse('series', seriesPage + 1, true)}>
                    {activeSearch ? (loadingMore.search ? 'Loading…' : 'Show More') : (loadingMore.series ? 'Loading…' : 'Show More')}<Icon name="arrow" size={16} />
                  </button>
                ) : null}
              </section>
            ) : null}
          </>
        )}

        <footer className="watcher-tmdb-attribution">
          <strong>TMDB</strong>
          <span>This Product Uses The TMDB API But Is Not Endorsed Or Certified By TMDB.</span>
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a>
        </footer>
      </div>

      <Modal open={Boolean(viewTarget)} onClose={() => setViewTarget(null)} title="Title Details" size="large" className="watcher-title-preview-modal">
        <TitlePreviewModal
          item={viewTarget}
          onClose={() => setViewTarget(null)}
          onAdd={(item) => { setViewTarget(null); openAdd(item) }}
        />
      </Modal>

      <Modal open={Boolean(addTarget)} onClose={() => adding ? null : setAddTarget(null)} title="Save To Watch Lists" size="large" className="watcher-picker-modal">
        {addTarget ? (
          <AddToWatchlistDialog
            item={addTarget}
            watchlists={watchlists}
            existingListIds={existingListIds(addTarget)}
            onCreate={async (payload) => { const created = await createWatchlist(payload); notify?.(`Created ${created.name}.`, 'success'); return created }}
            onConfirm={confirmAdd}
            onCancel={() => setAddTarget(null)}
            saving={adding}
          />
        ) : null}
      </Modal>
    </div>
  )
}
