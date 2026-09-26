import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../context'
import { discoverRandomCandidates, getGenres } from '../lib/tmdb'
import { titleCaseText, labelType } from '../lib/utils'
import { Icon } from '../components/Icon'

const runtimeOptions = [
  ['', 'Any'],
  ['0-90', 'Under 90 min'],
  ['90-120', '90–120 min'],
  ['120-150', '120–150 min'],
  ['150-180', '150–180 min'],
  ['180-', '180+ min'],
]

function parseRuntime(runtime) {
  if (!runtime) return { min: '', max: '' }
  if (runtime.endsWith('-')) return { min: runtime.slice(0, -1), max: '' }
  const [min, max] = runtime.split('-')
  return { min, max }
}

function itemRuntime(item) {
  if (item.type === 'movie') return Number(item.runtime_minutes) || 0
  return Number(item.episode_runtime_minutes) || 0
}

export default function RandomPicker({ embedded = false, sourceItems = null, title = 'Random Pick', onView = null }) {
  const navigate = useNavigate()
  const { items: libraryItems } = useLibrary()
  const [type, setType] = useState('any')
  const [genre, setGenre] = useState('')
  const [genreMaps, setGenreMaps] = useState(null)
  const [runtime, setRuntime] = useState('')
  const [matches, setMatches] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getGenres().then(setGenreMaps).catch(() => null)
  }, [])

  const genreOptions = useMemo(() => {
    if (!genreMaps) return []
    if (type === 'movie') return genreMaps.movies
    if (type === 'series') return genreMaps.series
    return [...new Map([...genreMaps.movies, ...genreMaps.series].map((entry) => [entry.id, entry])).values()]
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [genreMaps, type])

  const matchesFilters = (item) => {
    if (type !== 'any' && item.type !== type) return false
    const genreNames = Array.isArray(item.genre_names) ? item.genre_names : (Array.isArray(item.genre) ? item.genre : [])
    if (genre && !genreNames.some((name) => String(name).toLowerCase() === String(genre).toLowerCase())) return false
    const { min, max } = parseRuntime(runtime)
    const runtimeValue = itemRuntime(item)
    if (min !== '' && runtimeValue && runtimeValue < Number(min)) return false
    if (max !== '' && runtimeValue && runtimeValue > Number(max)) return false
    if (runtime && !runtimeValue) return false
    return true
  }

  const pick = async () => {
    setLoading(true)
    setError('')

    try {
      // Watchlist mode is intentionally filter-free: choose only from the
      // titles already present in the opened Watch List.
      if (embedded && Array.isArray(sourceItems)) {
        if (!sourceItems.length) {
          throw new Error('Add A Movie Or Series To This Watch List First.')
        }

        const choice = sourceItems[Math.floor(Math.random() * sourceItems.length)]
        const normalized = {
          ...choice,
          title: titleCaseText(choice.title),
          genre_names: choice.genre_names || choice.genre || [],
        }
        setMatches([normalized])
        setResult(normalized)
        if (onView) onView(normalized)
        return
      }

      let candidates = []

      if (Array.isArray(sourceItems)) {
        candidates = [...sourceItems]
      } else {
        const chosenTypes = type === 'any' ? ['movie', 'series'] : [type]
        const { min, max } = parseRuntime(runtime)
        for (const chosenType of chosenTypes) {
          const genreMap = chosenType === 'movie' ? genreMaps?.movieByName : genreMaps?.seriesByName
          const genreId = genreMap?.get(genre) || ''
          const pages = await Promise.all(
            [1, 2].map((page) => discoverRandomCandidates({
              type: chosenType,
              genreId,
              runtimeMin: min,
              runtimeMax: max,
              page,
            }).catch(() => ({ results: [] }))),
          )
          candidates.push(...pages.flatMap((page) => page.results || []))
        }
      }

      const deduped = [...new Map(
        candidates.map((item) => [`${item.type}-${item.tmdb_id}`, item]),
      ).values()]

      const uniqueCandidates = sourceItems
        ? deduped
        : deduped.filter((candidate) => !libraryItems.some((saved) => saved.tmdb_id === candidate.tmdb_id && saved.type === candidate.type && saved.status === 'watched'))

      const filtered = uniqueCandidates
        .filter(matchesFilters)
        .map((item) => ({
          ...item,
          title: titleCaseText(item.title),
          genre_names: item.genre_names || item.genre || [],
        }))

      if (!filtered.length) {
        throw new Error('No Titles Match Those Filters. Try A Wider Genre Or Runtime Range.')
      }

      setMatches(filtered)
      setResult(filtered[Math.floor(Math.random() * filtered.length)])
    } catch (err) {
      setMatches([])
      setResult(null)
      setError(err.message || 'Unable To Pick A Title.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!embedded || !Array.isArray(sourceItems)) return
    pick()
    // Embedded mode is mounted only when the watchlist Random Pick modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, sourceItems])

  const Picker = (
    <>
      {!embedded ? <section className="watcher-picker-panel watcher-random-pick-panel">
        <div className="watcher-picker-field">
          <label>Type</label>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="any">Any</option>
            <option value="movie">Movie</option>
            <option value="series">Web Series</option>
          </select>
        </div>

        <div className="watcher-picker-field">
          <label>Genre</label>
          <select value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="">Any</option>
            {genreOptions.map((entry) => <option value={entry.name} key={`${entry.id}-${entry.name}`}>{entry.name}</option>)}
          </select>
        </div>

        <div className="watcher-picker-field">
          <label>Runtime</label>
          <select value={runtime} onChange={(event) => setRuntime(event.target.value)}>
            {runtimeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>

        <button className="watcher-primary-button watcher-picker-button" onClick={pick} disabled={loading}>
          <Icon name="refresh" size={16} />
          {loading ? 'Finding Matches…' : title}
        </button>
      </section> : null}

      {error ? <div className="watcher-feature-empty watcher-error">{error}</div> : null}

      {result ? (
        <article
          className={`watcher-picker-result watcher-random-pick-result ${embedded ? 'watcher-random-pick-result-embedded' : ''}`}
          style={{
            '--watcher-random-pick-bg': `url("${result.backdrop_url || (result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : result.poster_url || '/modal-background.png')}")`,
          }}
        >
          <div className="watcher-picker-result-poster">
            {result.poster_url ? <img src={result.poster_url} alt={`${result.title} Poster`} /> : <Icon name="play" size={24} />}
          </div>
          <div className="watcher-picker-result-copy">
            <h2>{titleCaseText(result.title)}</h2>
            {!embedded ? (
              <>
                <div className="watcher-picker-result-meta">
                  <span>{labelType(result.type)}</span>
                  {result.year ? <span>{result.year}</span> : null}
                  {itemRuntime(result) ? <span>{itemRuntime(result)} min</span> : null}
                </div>
                <div className="watcher-detail-genres">{(result.genre_names || []).slice(0, 5).map((entry) => <span key={entry}>{entry}</span>)}</div>
                <p>{titleCaseText(result.overview || result.description || 'No Description Is Available.')}</p>
              </>
            ) : null}
            <div className="watcher-picker-result-actions">
              <button className="watcher-primary-button" onClick={() => onView ? onView(result) : navigate(`/discover?query=${encodeURIComponent(result.title)}`)}>View Title</button>
            </div>
          </div>
        </article>
      ) : null}

      {!embedded && matches.length ? (
        <section className="watcher-random-pick-matches">
          <div className="watcher-stats-feature-heading">
            <div>
              <span className="watcher-kicker">MATCHES</span>
              <h3>{matches.length} Matching {matches.length === 1 ? 'Title' : 'Titles'}</h3>
            </div>
          </div>
          <div className="watcher-random-pick-grid">
            {matches.map((item) => (
              <button key={`${item.type}-${item.tmdb_id}`} type="button" className="watcher-random-pick-card" onClick={() => navigate(`/discover?query=${encodeURIComponent(item.title)}`)}>
                <div>{item.poster_url ? <img src={item.poster_url} alt="" /> : <Icon name="play" size={20} />}</div>
                <strong>{titleCaseText(item.title)}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )

  if (embedded) return Picker

  return (
    <div className="watcher-feature-page watcher-picker-page">
      <div className="page-container watcher-feature-container">
        <button className="watcher-back-button" onClick={() => navigate('/stats')}><Icon name="back" size={16} /> Stats</button>
        <section className="watcher-feature-heading"><span className="watcher-kicker">RANDOM PICK</span><h1>{title}</h1><p>Set the filters. Watcher picks from the titles available in this list.</p></section>
        {Picker}
      </div>
    </div>
  )
}
