import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLibrary } from '../context'
import { getExternalIds, getSeasonDetails, getTitleDetails } from '../lib/tmdb'
import { getStreamAddons, findPlayableStreamsProgressive } from '../lib/streamAddons'
import { findSubtitles } from '../lib/subtitles'
import StreamPlayer from '../components/StreamPlayer'
import { Icon } from '../components/Icon'
import { titleCaseText } from '../lib/utils'

const PRIORITY_GRACE_MS = 450

function range(count) {
  return Array.from({ length: Math.max(1, Number(count) || 1) }, (_, index) => index + 1)
}

function mergePlayable(results) {
  const streams = results.flatMap((result) => result?.playable || [])
  return [...new Map(streams.filter((source) => source?.url).map((source) => [source.url, source])).values()]
    .sort((a, b) => {
      const provider = Number(b.addonPriority || 0) - Number(a.addonPriority || 0)
      if (provider) return provider
      const match = Number(b.matchScore || 0) - Number(a.matchScore || 0)
      if (match) return match
      return Number(b.quality || 0) - Number(a.quality || 0)
    })
}

export default function StreamPage({ notify }) {
  const { watchlistId, itemId } = useParams()
  const navigate = useNavigate()
  const { watchlists, items, updateItem } = useLibrary()
  const item = useMemo(() => items.find((entry) => entry.id === itemId), [items, itemId])
  const list = useMemo(() => watchlists.find((entry) => entry.id === watchlistId), [watchlists, watchlistId])

  const [streams, setStreams] = useState([])
  const [subtitles, setSubtitles] = useState([])
  const [seasonEpisodes, setSeasonEpisodes] = useState([])
  const [totalSeasons, setTotalSeasons] = useState(Number(item?.total_seasons) || 1)
  const [selection, setSelection] = useState({
    season: Math.max(1, Number(item?.current_season) || 1),
    episode: Math.max(1, Number(item?.current_episode) || 1),
  })
  const [searchComplete, setSearchComplete] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const searchRequestRef = useRef(0)
  const priorityTimerRef = useRef(null)
  const searchStateRef = useRef({ tmdb: null, imdb: null, imdbStarted: false })

  useEffect(() => {
    if (item?.type !== 'series' || !item.tmdb_id) return
    const season = selection.season
    getSeasonDetails(item.tmdb_id, season)
      .then((data) => {
        setSeasonEpisodes(Array.isArray(data?.episodes) ? data.episodes : [])
        const firstEpisode = data?.episodes?.[0]?.episode_number || 1
        setSelection((current) => ({
          ...current,
          episode: data?.episodes?.some((entry) => entry.episode_number === current.episode) ? current.episode : firstEpisode,
        }))
      })
      .catch(() => setSeasonEpisodes([]))
  }, [item?.tmdb_id, item?.type, selection.season])

  useEffect(() => {
    if (!item || item.type !== 'series') return
    if (Number(item.total_seasons) > 0) {
      setTotalSeasons(Number(item.total_seasons))
      return
    }
    getTitleDetails(item.tmdb_id, 'series')
      .then((details) => {
        if (Number(details.total_seasons) > 0) setTotalSeasons(Number(details.total_seasons))
      })
      .catch(() => null)
  }, [item])

  const loadSources = useCallback(async () => {
    if (!item?.tmdb_id) return
    const requestId = ++searchRequestRef.current
    if (priorityTimerRef.current) window.clearTimeout(priorityTimerRef.current)
    priorityTimerRef.current = null
    setSearchComplete(false)
    setAutoStart(false)
    setStreams([])
    setSubtitles([])
    searchStateRef.current = { tmdb: null, imdb: null, imdbStarted: false }

    const addons = getStreamAddons()
    const context = {
      expectedTitle: item.title,
      expectedYear: item.year,
      type: item.type,
      season: item.type === 'series' ? selection.season : undefined,
      episode: item.type === 'series' ? selection.episode : undefined,
    }

    const pushResults = (key, result) => {
      if (requestId !== searchRequestRef.current) return
      searchStateRef.current[key] = result
      const merged = mergePlayable([searchStateRef.current.tmdb, searchStateRef.current.imdb])
      setStreams(merged)

      if (merged.length && !autoStart) {
        const hasPengu = merged.some((source) => source.addonId === 'penguplay')
        if (hasPengu) {
          if (priorityTimerRef.current) window.clearTimeout(priorityTimerRef.current)
          priorityTimerRef.current = null
          setAutoStart(true)
        } else if (!priorityTimerRef.current) {
          priorityTimerRef.current = window.setTimeout(() => {
            priorityTimerRef.current = null
            if (requestId === searchRequestRef.current) setAutoStart(true)
          }, PRIORITY_GRACE_MS)
        }
      }

      const tmdbComplete = searchStateRef.current.tmdb?.complete === true
      const imdbComplete = searchStateRef.current.imdb?.complete === true
      const imdbFinishedOrNotNeeded = searchStateRef.current.imdbStarted ? imdbComplete : false
      if (tmdbComplete && imdbFinishedOrNotNeeded) {
        setSearchComplete(true)
        if (merged.length) setAutoStart(true)
      }
    }

    const tmdbSearch = findPlayableStreamsProgressive({
      addons,
      type: item.type,
      ids: { imdbId: '', tmdbId: item.tmdb_id },
      context,
      onUpdate: (result) => pushResults('tmdb', result),
    }).catch(() => null)

    const idsPromise = getExternalIds(item.tmdb_id, item.type)

    const subtitleVideoIdPromise = idsPromise
      .then((ids) => ids?.imdb_id
        ? (item.type === 'series' ? `${ids.imdb_id}:${selection.season}:${selection.episode}` : ids.imdb_id)
        : (item.type === 'series' ? `tmdb:${item.tmdb_id}:${selection.season}:${selection.episode}` : `tmdb:${item.tmdb_id}`))
      .catch(() => (item.type === 'series' ? `tmdb:${item.tmdb_id}:${selection.season}:${selection.episode}` : `tmdb:${item.tmdb_id}`))

    subtitleVideoIdPromise
      .then((videoId) => findSubtitles({ type: item.type, videoId }))
      .then((result) => {
        if (requestId === searchRequestRef.current) setSubtitles(result.tracks || [])
      })
      .catch(() => null)

    try {
      const ids = await idsPromise
      if (requestId !== searchRequestRef.current) return

      const imdbId = ids?.imdb_id
        ? (item.type === 'series' ? `${ids.imdb_id}:${selection.season}:${selection.episode}` : ids.imdb_id)
        : ''

      if (imdbId) {
        searchStateRef.current.imdbStarted = true
        const imdbSearch = findPlayableStreamsProgressive({
          addons,
          type: item.type,
          ids: { imdbId, tmdbId: ids.tmdb_id || item.tmdb_id },
          context,
          onUpdate: (result) => pushResults('imdb', result),
        })

        imdbSearch
          .then((result) => pushResults('imdb', result))
          .catch(() => pushResults('imdb', { playable: [], complete: true }))
      } else {
        searchStateRef.current.imdbStarted = false
      }

      const tmdbResult = await tmdbSearch
      if (requestId !== searchRequestRef.current) return
      if (tmdbResult) pushResults('tmdb', tmdbResult)

      if (!imdbId) {
        setSearchComplete(true)
        const merged = mergePlayable([searchStateRef.current.tmdb])
        if (merged.length) setAutoStart(true)
      }
    } catch (error) {
      const tmdbResult = await tmdbSearch.catch(() => null)
      if (requestId !== searchRequestRef.current) return
      if (tmdbResult) pushResults('tmdb', tmdbResult)
      if (!searchStateRef.current.imdbStarted) setSearchComplete(true)
      if (!tmdbResult?.playable?.length && !searchStateRef.current.imdbStarted) {
        notify?.(error.message || 'Unable To Find Streaming Sources.', 'error')
      }
    }
  }, [item, notify, selection.episode, selection.season])

  useEffect(() => {
    loadSources()
    return () => {
      if (priorityTimerRef.current) window.clearTimeout(priorityTimerRef.current)
      priorityTimerRef.current = null
    }
  }, [loadSources])

  if (!item || !list) {
    return (
      <div className="watcher-stream-page watcher-stream-page-error">
        <button type="button" className="watcher-stream-back" onClick={() => navigate(-1)}><Icon name="back" size={18} /> Back</button>
        <div className="watcher-stream-fallback"><h1>Title Not Found.</h1></div>
      </div>
    )
  }

  const changeSeason = (season) => {
    const nextSeason = Math.max(1, Number(season) || 1)
    setSelection({ season: nextSeason, episode: 1 })
    updateItem(item.id, { current_season: nextSeason, current_episode: 1 }).catch(() => null)
  }

  const changeEpisode = (episode) => {
    const nextEpisode = Math.max(1, Number(episode) || 1)
    setSelection((current) => ({ ...current, episode: nextEpisode }))
    updateItem(item.id, { current_season: selection.season, current_episode: nextEpisode }).catch(() => null)
  }

  return (
    <div className="watcher-stream-page">
      <div className="watcher-stream-topbar">
        <button type="button" className="watcher-stream-back" onClick={() => navigate(`/watchlists/${watchlistId}`)} aria-label="Back to watch list">
          <Icon name="back" size={18} />
        </button>
        <div className="watcher-stream-heading">
          <span className="watcher-kicker">NOW PLAYING</span>
          <h1>{titleCaseText(item.title)}</h1>
        </div>
        {item.type === 'series' ? (
          <div className="watcher-stream-episode-controls">
            <label><span>Season</span><select value={selection.season} onChange={(event) => changeSeason(event.target.value)}>{range(totalSeasons).map((season) => <option key={season} value={season}>{season}</option>)}</select></label>
            <label><span>Episode</span><select value={selection.episode} onChange={(event) => changeEpisode(event.target.value)}>{(seasonEpisodes.length ? seasonEpisodes.map((entry) => entry.episode_number) : range(Number(item.total_episodes) || 1)).map((episode) => <option key={episode} value={episode}>{episode}{seasonEpisodes.find((entry) => entry.episode_number === episode)?.name ? ` · ${seasonEpisodes.find((entry) => entry.episode_number === episode).name}` : ''}</option>)}</select></label>
          </div>
        ) : null}
      </div>
      <StreamPlayer
        playbackKey={`${item.id}:${item.type}:${selection.season}:${selection.episode}`}
        streams={streams}
        subtitleTracks={subtitles}
        discoveryComplete={searchComplete}
        autoStart={autoStart}
        onSuccess={() => null}
        onAllFailed={() => { if (searchComplete) notify?.('Playback Failed. No Other Browser Source Is Available.', 'error') }}
      />
    </div>
  )
}
