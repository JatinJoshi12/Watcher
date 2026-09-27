import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import StreamPlayer from './StreamPlayer'
import {
  getStreamAddons,
  findPlayableStreamsProgressive,
  rankBrowserStreams,
} from '../lib/streamAddons'
import { getExternalIds, getSeasonDetails, getTitleDetails } from '../lib/tmdb'
import { findSubtitles } from '../lib/subtitles'
import { fetchWatchNext } from '../lib/watchNext'

function range(count) {
  return Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) => index + 1)
}

export default function StreamSourcePanel({ item, notify, onUpdateItem }) {
  const [loading, setLoading] = useState(true)
  const [searchingMore, setSearchingMore] = useState(false)
  const [streams, setStreams] = useState([])
  const [allStreams, setAllStreams] = useState([])
  const [subtitleTracks, setSubtitleTracks] = useState([])
  const [errors, setErrors] = useState([])
  const [activePlayer, setActivePlayer] = useState(false)
  const [seasonEpisodes, setSeasonEpisodes] = useState([])
  const [episodeLoading, setEpisodeLoading] = useState(false)
  const [selection, setSelection] = useState({
    season: Math.max(1, Number(item.current_season) || 1),
    episode: Math.max(1, Number(item.current_episode) || 1),
  })
  const [nextWatch, setNextWatch] = useState([])
  const [resolvedTotalSeasons, setResolvedTotalSeasons] = useState(Number(item.total_seasons) || 1)
  const [nextWatchError, setNextWatchError] = useState('')
  const requestIdRef = useRef(0)
  const idsRef = useRef(null)
  const sourceKeyRef = useRef('')
  const playerRef = useRef(null)

  const totalSeasons = Math.max(1, Number(resolvedTotalSeasons) || 1)
  const episodeOptions = seasonEpisodes.length
    ? seasonEpisodes.map((episode) => episode.episode_number)
    : range(Math.max(1, Number(item.total_episodes) || 1))

  const selectedEpisodeExists = episodeOptions.includes(selection.episode)

  const resolveIds = useCallback(async () => {
    if (idsRef.current) return idsRef.current
    if (!item.tmdb_id) throw new Error('This Title Does Not Have A TMDB ID.')
    const external = await getExternalIds(item.tmdb_id, item.type)
    if (!external.imdb_id && !external.tmdb_id) {
      throw new Error('IMDb/TMDB ID Could Not Be Resolved For This Title.')
    }
    idsRef.current = {
      imdbId: external.imdb_id,
      tmdbId: external.tmdb_id || Number(item.tmdb_id),
    }
    return idsRef.current
  }, [item.tmdb_id, item.type])

  const loadSeason = useCallback(async (season) => {
    if (item.type !== 'series' || !item.tmdb_id) return
    setEpisodeLoading(true)
    try {
      const result = await getSeasonDetails(item.tmdb_id, season)
      const episodes = result.episodes || []
      setSeasonEpisodes(episodes)
      const first = episodes[0]?.episode_number || 1
      setSelection((current) => ({
        ...current,
        season,
        episode: episodes.some((episode) => episode.episode_number === current.episode)
          ? current.episode
          : first,
      }))
    } catch {
      setSeasonEpisodes([])
    } finally {
      setEpisodeLoading(false)
    }
  }, [item.tmdb_id, item.type])

  const persistEpisodeSelection = useCallback((season, episode) => {
    if (item.type !== 'series') return
    const pending = onUpdateItem?.(item.id, {
      current_season: season,
      current_episode: episode,
    })
    pending?.catch?.(() => null)
  }, [item.id, item.type, onUpdateItem])

  const loadSources = useCallback(async () => {
    const requestId = ++requestIdRef.current
    const nextSourceKey = `${item.type}|${item.tmdb_id}|${selection.season}|${selection.episode}`
    const sameSourceKey = sourceKeyRef.current === nextSourceKey
    sourceKeyRef.current = nextSourceKey
    setLoading(!sameSourceKey || streams.length === 0)
    setSearchingMore(true)
    setActivePlayer(false)
    setErrors([])
    if (!sameSourceKey) {
      setStreams([])
      setAllStreams([])
      setSubtitleTracks([])
    }
    setNextWatch([])
    setNextWatchError('')

    try {
      const ids = await resolveIds()
      const videoIdType = item.type

      // Source discovery is the critical path. Don't wait for subtitles or
      // recommendations before allowing the user to press Play.
      const sourcePromise = findPlayableStreamsProgressive({
        addons: getStreamAddons(),
        type: videoIdType,
        ids,
        onAddonResult: ({ all, errors: nextErrors }) => {
          if (requestId !== requestIdRef.current) return
          const ranked = rankBrowserStreams(all)
          const streamSubtitles = all.flatMap((stream) => (stream.subtitles || []).map((subtitle, index) => ({
            id: subtitle?.id || `${stream.id}-sub-${index}`,
            url: subtitle?.url || subtitle?.file || '',
            lang: subtitle?.lang || subtitle?.language || 'en',
            label: subtitle?.label || subtitle?.lang || subtitle?.language || 'English',
            format: String(subtitle?.format || '').toLowerCase(),
          }))).filter((track) => track.url)
          setAllStreams(all)
          setStreams(ranked)
          setErrors(nextErrors)
          setSubtitleTracks((current) => [...current, ...streamSubtitles]
            .filter((track, index, array) => array.findIndex((candidate) => candidate.url === track.url) === index))
          if (ranked.length) setLoading(false)
        },
      })

      // These are deliberately independent of the source critical path.
      findSubtitles({
        type: videoIdType,
        videoId: ids.imdbId || `tmdb:${ids.tmdbId}`,
      }).then((subtitleResult) => {
        if (requestId !== requestIdRef.current) return
        setSubtitleTracks((current) => [...(subtitleResult.tracks || []), ...current]
          .filter((track, index, array) => array.findIndex((candidate) => candidate.url === track.url) === index))
        if (subtitleResult.error) {
          setErrors((current) => [...current, { addon: 'OpenSubtitles', error: subtitleResult.error }])
        }
      }).catch(() => null)

      fetchWatchNext({
        type: videoIdType,
        videoId: ids.imdbId || `tmdb:${ids.tmdbId}`,
      }).then((nextResult) => {
        if (requestId === requestIdRef.current) setNextWatch(nextResult || [])
      }).catch((error) => {
        if (requestId === requestIdRef.current) setNextWatchError(error?.message || 'Next Watch Unavailable.')
      })

      const sourceResult = await sourcePromise
      if (requestId !== requestIdRef.current) return
      setAllStreams(sourceResult.all)
      setStreams(sourceResult.playable)
      setErrors((current) => {
        const sourceErrors = sourceResult.errors || []
        const nonAddon = current.filter((entry) => entry.addon === 'OpenSubtitles')
        return [...sourceErrors, ...nonAddon]
      })
      if (!sourceResult.playable.length) setLoading(false)
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setErrors([{ addon: 'Watcher', error: error.message || 'Unable To Find Streams.' }])
      notify?.(error.message || 'Unable To Find Streams.', 'error')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setSearchingMore(false)
      }
    }
  }, [item.type, notify, resolveIds])

  useEffect(() => {
    let active = true
    if (item.type !== 'series' || !item.tmdb_id) return undefined
    if (Number(item.total_seasons) > 0) {
      setResolvedTotalSeasons(Number(item.total_seasons))
      return undefined
    }
    getTitleDetails(item.tmdb_id, 'series').then((details) => {
      if (active && Number(details.total_seasons) > 0) setResolvedTotalSeasons(Number(details.total_seasons))
    }).catch(() => null)
    return () => { active = false }
  }, [item.tmdb_id, item.total_seasons, item.type])

  useEffect(() => {
    if (item.type === 'series') loadSeason(selection.season)
  }, [item.type, selection.season, loadSeason])

  useEffect(() => {
    loadSources()
  }, [loadSources, selection.episode, selection.season])

  const handleSeasonChange = (value) => {
    const season = Math.max(1, Number(value) || 1)
    setSelection((current) => ({ ...current, season, episode: 1 }))
    persistEpisodeSelection(season, 1)
  }

  const handleEpisodeChange = (value) => {
    const episode = Math.max(1, Number(value) || 1)
    setSelection((current) => ({ ...current, episode }))
    persistEpisodeSelection(selection.season, episode)
  }

  const browserCount = streams.length
  const subtitleCount = subtitleTracks.length
  const sourceLabel = searchingMore && browserCount
    ? `${browserCount} Browser Source${browserCount === 1 ? '' : 's'} Ready · Finding More…`
    : loading
      ? 'Finding The Fastest Available Source…'
    : browserCount
      ? `${browserCount} Browser Source${browserCount === 1 ? '' : 's'} Queued For Playback.`
      : allStreams.length
        ? `${allStreams.length} Source${allStreams.length === 1 ? '' : 's'} Found, But None Can Play Directly In This Browser.`
        : 'No Compatible Source Was Returned.'

  const playerStreams = useMemo(() => streams, [streams])

  const startPlayback = () => {
    setActivePlayer(true)
    playerRef.current?.start?.()
  }

  const closePlayer = () => {
    playerRef.current?.stop?.()
    setActivePlayer(false)
  }

  return (
    <section className="watcher-stream-section">
      <div className="watcher-stream-header">
        <div>
          <span className="watcher-kicker">WATCH NOW</span>
          <h2>One-Click Streaming</h2>
          <p>Watcher checks your enabled addons, ranks compatible sources, and handles fallback automatically.</p>
        </div>
        <div className="watcher-stream-count-card">
          <strong>{loading ? '…' : browserCount || allStreams.length}</strong>
          <span>{loading ? 'CHECKING' : browserCount ? 'READY' : 'SOURCES'}</span>
        </div>
      </div>

      {item.type === 'series' ? (
        <div className="watcher-stream-episode-controls">
          <label>
            <span>Season</span>
            <select value={selection.season} onChange={(event) => handleSeasonChange(event.target.value)} disabled={episodeLoading || loading}>
              {range(totalSeasons).map((season) => <option key={season} value={season}>Season {season}</option>)}
            </select>
          </label>

          <label>
            <span>Episode</span>
            <select value={selectedEpisodeExists ? selection.episode : episodeOptions[0]} onChange={(event) => handleEpisodeChange(event.target.value)} disabled={episodeLoading || loading}>
              {episodeOptions.map((episodeNumber) => {
                const detail = seasonEpisodes.find((episode) => episode.episode_number === episodeNumber)
                return <option key={episodeNumber} value={episodeNumber}>Episode {episodeNumber}{detail?.name ? ` · ${detail.name}` : ''}</option>
              })}
            </select>
          </label>
        </div>
      ) : null}

      <div className="watcher-stream-primary-actions">
        <button
          className="watcher-primary-button watcher-stream-play-button"
          type="button"
          onClick={startPlayback}
          disabled={!playerStreams.length}
        >
          <Icon name="play" size={17} />
          {loading && !playerStreams.length ? 'Finding Stream…' : playerStreams.length ? 'Play Now' : 'No Browser Stream'}
        </button>
        <button className="watcher-secondary-button" type="button" onClick={loadSources} disabled={searchingMore}>
          <Icon name="refresh" size={14} />
          Refresh Sources
        </button>
      </div>

      <div className={`watcher-stream-status ${browserCount ? 'ready' : allStreams.length ? 'warning' : 'empty'}`}>
        <span>{browserCount ? '✓' : '!'}</span>
        <strong>{sourceLabel}</strong>
        {subtitleCount ? <em>{subtitleCount} subtitle track{subtitleCount === 1 ? '' : 's'} available.</em> : null}
      </div>

      {playerStreams.length ? (
        <StreamPlayer
          ref={playerRef}
          visible={activePlayer}
          streams={playerStreams}
          subtitleTracks={subtitleTracks}
          onClose={closePlayer}
          onSuccess={(stream) => notify?.(`Playing From ${stream.addonName}.`, 'success')}
          onAllFailed={() => notify?.('All Browser-Compatible Sources Failed.', 'error')}
        />
      ) : null}

      {nextWatch.length ? (
        <section className="watcher-next-watch-panel">
          <div className="watcher-stream-subheading">
            <div>
              <span className="watcher-kicker">NEXT WATCH</span>
              <h3>More Like This</h3>
            </div>
          </div>
          <div className="watcher-next-watch-list">
            {nextWatch.map((entry) => (
              <a key={entry.id} href={entry.url} target="_blank" rel="noreferrer" className="watcher-next-watch-item">
                <span>{entry.title}</span>
                <Icon name="arrow" size={14} />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {errors.length ? (
        <details className="watcher-stream-errors">
          <summary>Addon Status ({errors.length} notices)</summary>
          <div>
            {errors.map((entry, index) => <span key={`${entry.addon}-${index}-${entry.error}`}>{entry.addon}: {entry.error}</span>)}
          </div>
        </details>
      ) : null}

      {nextWatchError ? <div className="watcher-stream-note">Watch Next is unavailable for this title right now.</div> : null}
    </section>
  )
}
