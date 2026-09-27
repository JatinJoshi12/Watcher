import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLibrary } from '../context'
import { getExternalIds, getSeasonDetails, getTitleDetails } from '../lib/tmdb'
import { getStreamAddons, findPlayableStreamsProgressive } from '../lib/streamAddons'
import { findSubtitles } from '../lib/subtitles'
import StreamPlayer from '../components/StreamPlayer'
import { Icon } from '../components/Icon'
import { titleCaseText } from '../lib/utils'

const PRIORITY_GRACE_MS = 1100

function range(count) {
  return Array.from({ length: Math.max(1, Number(count) || 1) }, (_, index) => index + 1)
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
  const searchStartedAtRef = useRef(0)
  const searchRequestRef = useRef(0)

  useEffect(() => {
    if (item?.type !== 'series' || !item.tmdb_id) return
    const season = selection.season
    getSeasonDetails(item.tmdb_id, season).then((data) => {
      setSeasonEpisodes(Array.isArray(data?.episodes) ? data.episodes : [])
      if (data?.season_number && data.season_number !== selection.season) return
      const firstEpisode = data?.episodes?.[0]?.episode_number || 1
      setSelection((current) => ({
        ...current,
        episode: data?.episodes?.some((entry) => entry.episode_number === current.episode) ? current.episode : firstEpisode,
      }))
    }).catch(() => setSeasonEpisodes([]))
  }, [item?.tmdb_id, item?.type, selection.season])

  useEffect(() => {
    if (!item || item.type !== 'series') return
    if (Number(item.total_seasons) > 0) {
      setTotalSeasons(Number(item.total_seasons))
      return
    }
    getTitleDetails(item.tmdb_id, 'series').then((details) => {
      if (Number(details.total_seasons) > 0) setTotalSeasons(Number(details.total_seasons))
    }).catch(() => null)
  }, [item])

  const loadSources = useCallback(async () => {
    if (!item?.tmdb_id) return
    const requestId = ++searchRequestRef.current
    setSearchComplete(false)
    setAutoStart(false)
    setStreams([])
    searchStartedAtRef.current = Date.now()

    try {
      const ids = await getExternalIds(item.tmdb_id, item.type)
      if (requestId !== searchRequestRef.current) return

      findSubtitles({
        type: item.type,
        videoId: item.type === 'series'
          ? `${ids.imdb_id || `tmdb:${ids.tmdb_id}`}:${selection.season}:${selection.episode}`
          : (ids.imdb_id || `tmdb:${ids.tmdb_id}`),
      }).then((result) => {
        if (requestId === searchRequestRef.current) setSubtitles(result.tracks || [])
      }).catch(() => null)

      const sourceResult = findPlayableStreamsProgressive({
        addons: getStreamAddons(),
        type: item.type,
        ids: {
          imdbId: item.type === 'series'
            ? `${ids.imdb_id || `tmdb:${ids.tmdb_id}`}:${selection.season}:${selection.episode}`
            : ids.imdb_id,
          tmdbId: ids.tmdb_id,
        },
        onUpdate: ({ playable, complete }) => {
          if (requestId !== searchRequestRef.current) return
          setStreams(playable)
          if (playable.length && (
            playable.some((source) => source.addonId === 'penguplay')
            || Date.now() - searchStartedAtRef.current >= PRIORITY_GRACE_MS
            || complete
          )) {
            setAutoStart(true)
          }
          if (complete) setSearchComplete(true)
        },
      })

      const result = await sourceResult
      if (requestId !== searchRequestRef.current) return
      setStreams(result.playable)
      setSearchComplete(true)
      if (result.playable.length && !autoStart) setAutoStart(true)
    } catch (error) {
      if (requestId !== searchRequestRef.current) return
      setSearchComplete(true)
      notify?.(error.message || 'Unable To Find Streaming Sources.', 'error')
    }
  }, [item, notify, selection.episode, selection.season])

  useEffect(() => {
    loadSources()
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
      <StreamPlayer streams={streams} subtitleTracks={subtitles} discoveryComplete={searchComplete} autoStart={autoStart} onSuccess={() => null} onAllFailed={() => { if (searchComplete) notify?.('Playback Failed. No Other Browser Source Is Available.', 'error') }} />
    </div>
  )
}
