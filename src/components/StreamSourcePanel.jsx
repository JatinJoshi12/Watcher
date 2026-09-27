import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import StreamPlayer from './StreamPlayer'
import { getAllStreams, getConfiguredAddons, getPrimaryPlayableSource, getSubtitles } from '../lib/stremioAddons'
import { getExternalIds } from '../lib/tmdb'

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export default function StreamSourcePanel({ item, updateItem, notify, autoPlay = false }) {
  const [addons, setAddons] = useState(() => getConfiguredAddons())
  const [streams, setStreams] = useState([])
  const [playable, setPlayable] = useState([])
  const [subtitles, setSubtitles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(null)
  const [seasonDetails, setSeasonDetails] = useState(null)
  const [seasonLoading, setSeasonLoading] = useState(false)
  const playableRef = useRef([])
  const autoStartedRef = useRef(false)
  const autoStartTimerRef = useRef(null)

  const isSeries = item.type === 'series'
  const season = numberOrNull(item.current_season) || 1
  const episode = numberOrNull(item.current_episode) || 1

  const availableSeasons = useMemo(() => {
    const total = numberOrNull(item.total_seasons)
    return Array.from({ length: Math.max(total || season, 1) }, (_, index) => index + 1)
  }, [item.total_seasons, season])

  const episodeCount = seasonDetails?.episodes?.length || numberOrNull(item.total_episodes) || episode
  const availableEpisodes = Array.from({ length: Math.max(episodeCount, episode, 1) }, (_, index) => index + 1)

  const resolveId = useCallback(async () => {
    if (item.imdb_id) return item.imdb_id
    const external = await getExternalIds(item.tmdb_id, item.type)
    return external.imdb_id || ''
  }, [item.imdb_id, item.tmdb_id, item.type])

  const loadSeasonDetails = useCallback(async (seasonNumber) => {
    if (!isSeries) return
    setSeasonLoading(true)
    try {
      const { getSeasonDetails } = await import('../lib/tmdb')
      const data = await getSeasonDetails(item.tmdb_id, seasonNumber)
      setSeasonDetails(data)
    } catch {
      setSeasonDetails(null)
    } finally {
      setSeasonLoading(false)
    }
  }, [isSeries, item.tmdb_id])

  const addIncrementalPlayable = useCallback((source) => {
    const key = source.url || source.externalUrl || source.raw?.infoHash || `${source.addonName}|${source.title}`
    const exists = playableRef.current.some((entry) => {
      const entryKey = entry.url || entry.externalUrl || entry.raw?.infoHash || `${entry.addonName}|${entry.title}`
      return entryKey === key
    })
    if (exists) return

    const next = [...playableRef.current, source].sort((a, b) => b.score - a.score)
    playableRef.current = next
    setPlayable(next)

    if (autoPlay && !autoStartedRef.current && !autoStartTimerRef.current) {
      autoStartTimerRef.current = window.setTimeout(() => {
        autoStartTimerRef.current = null
        const best = playableRef.current[0]
        if (best && !autoStartedRef.current) {
          autoStartedRef.current = true
          setPlaying(best)
        }
      }, 180)
    }
  }, [autoPlay])

  const scanSources = useCallback(async (shouldAutoPlay = false) => {
    setLoading(true)
    setError('')
    playableRef.current = []
    autoStartedRef.current = false
    if (autoStartTimerRef.current) {
      window.clearTimeout(autoStartTimerRef.current)
      autoStartTimerRef.current = null
    }
    setPlayable([])

    try {
      const imdbId = await resolveId()
      if (!imdbId) throw new Error('IMDb ID could not be resolved for this title.')
      const videoId = isSeries ? `${imdbId}:${season}:${episode}` : imdbId
      const currentAddons = getConfiguredAddons()
      setAddons(currentAddons)

      // Start subtitle discovery in parallel so it does not delay first playback.
      getSubtitles(currentAddons, isSeries ? 'series' : 'movie', videoId, [])
        .then((subtitleResults) => setSubtitles(subtitleResults))
        .catch(() => setSubtitles([]))

      const result = await getAllStreams(
        currentAddons,
        isSeries ? 'series' : 'movie',
        videoId,
        shouldAutoPlay ? addIncrementalPlayable : undefined,
      )
      setStreams(result.streams)
      setPlayable(result.browserReady)
      playableRef.current = result.browserReady

      if (shouldAutoPlay && !autoStartedRef.current && result.browserReady.length) {
        autoStartedRef.current = true
        setPlaying(getPrimaryPlayableSource(result.browserReady))
      }

      // Merge any subtitle tracks returned with the stream objects as well.
      getSubtitles(currentAddons, isSeries ? 'series' : 'movie', videoId, result.streams)
        .then((subtitleResults) => setSubtitles(subtitleResults))
        .catch(() => null)

      if (!result.browserReady.length) {
        const message = result.streams.length
          ? `${result.streams.length} source${result.streams.length === 1 ? '' : 's'} found, but none are directly browser-playable.`
          : 'No stream sources were returned by the configured stream addons.'
        setError(message)
        return
      }

    } catch (scanError) {
      setError(scanError.message || 'Unable to find a playable source.')
    } finally {
      setLoading(false)
    }
  }, [addIncrementalPlayable, episode, isSeries, resolveId, season])

  useEffect(() => {
    if (isSeries) loadSeasonDetails(season)
  }, [isSeries, loadSeasonDetails, season])

  useEffect(() => {
    scanSources(autoPlay)
    return () => {
      if (autoStartTimerRef.current) {
        window.clearTimeout(autoStartTimerRef.current)
        autoStartTimerRef.current = null
      }
    }
  }, [autoPlay, scanSources])

  const updateEpisode = async (nextSeason, nextEpisode) => {
    try {
      if (!updateItem) return
      await updateItem(item.id, {
        current_season: nextSeason,
        current_episode: nextEpisode,
      })
      setPlaying(null)
      if (nextSeason !== season) await loadSeasonDetails(nextSeason)
    } catch (updateError) {
      notify?.(updateError.message || 'Unable To Save Episode Selection.', 'error')
    }
  }

  const startPlayback = () => {
    if (playable.length) {
      setPlaying(playable[0])
      return
    }
    scanSources(true)
  }

  const handlePlaybackError = useCallback((failedStream) => {
    const currentPlayable = playableRef.current.length ? playableRef.current : playable
    const index = currentPlayable.findIndex((stream) => (stream.url || '') === (failedStream.url || ''))
    const next = index >= 0 ? currentPlayable[index + 1] : currentPlayable[0]
    if (next) {
      setPlaying(next)
      notify?.(`Trying Another Source: ${next.addonName}.`, 'info')
    } else {
      setPlaying(null)
      notify?.('All Browser-Compatible Sources Failed.', 'error')
    }
  }, [notify, playable])

  const directSubtitles = subtitles.filter((subtitle) => subtitle.url)

  return (
    <section className="watcher-stream-panel">
      <div className="watcher-stream-panel-header">
        <div>
          <span className="watcher-kicker">WATCH NOW</span>
          <h2>One-Click Streaming</h2>
          <p>
            Watcher checks your enabled addons automatically and selects a browser-compatible source.
          </p>
        </div>
        <div className="watcher-stream-source-count">
          <strong>{streams.length}</strong>
          <span>Sources</span>
        </div>
      </div>

      {isSeries ? (
        <div className="watcher-episode-controls">
          <div>
            <span className="watcher-kicker">SERIES CONTROL</span>
            <h3>Choose Your Episode</h3>
          </div>
          <div className="watcher-episode-selects">
            <label>
              <span>Season</span>
              <select
                value={season}
                onChange={(event) => updateEpisode(Number(event.target.value), 1)}
                disabled={seasonLoading || loading}
              >
                {availableSeasons.map((number) => <option key={number} value={number}>Season {number}</option>)}
              </select>
            </label>
            <label>
              <span>Episode</span>
              <select
                value={episode}
                onChange={(event) => updateEpisode(season, Number(event.target.value))}
                disabled={seasonLoading || loading}
              >
                {availableEpisodes.map((number) => <option key={number} value={number}>Episode {number}</option>)}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <div className="watcher-stream-main-action">
        <button className="watcher-stream-play-button" onClick={startPlayback} disabled={loading && !playable.length}>
          <span className="watcher-stream-play-icon"><Icon name="play" size={22} /></span>
          <span>
            <strong>{loading && !playable.length ? 'Finding A Source…' : 'Stream Now'}</strong>
            <small>{isSeries ? `Season ${season} · Episode ${episode}` : 'Automatic source selection'}</small>
          </span>
        </button>
        <button className="watcher-secondary-button" onClick={() => scanSources(false)} disabled={loading}>
          <Icon name="refresh" size={16} />
          Refresh Sources
        </button>
      </div>

      {loading ? <div className="watcher-stream-status"><span className="watcher-player-loader small" /> Searching Enabled Addons…</div> : null}

      {error ? (
        <div className="watcher-stream-warning">
          <Icon name="close" size={17} />
          <div>
            <strong>{error}</strong>
            <span>Torrent, external-only, protected, or non-web-ready results cannot be played directly by a browser.</span>
          </div>
        </div>
      ) : null}

      {playable.length ? (
        <div className="watcher-stream-ready">
          <Icon name="check" size={16} />
          <span><strong>{playable.length}</strong> browser-compatible source{playable.length === 1 ? '' : 's'} ready.</span>
          {directSubtitles.length ? <span><strong>{directSubtitles.length}</strong> subtitle track{directSubtitles.length === 1 ? '' : 's'} available.</span> : null}
        </div>
      ) : null}

      {playing ? (
        <StreamPlayer
          stream={playing}
          title={`${item.title}${isSeries ? ` · S${season}E${episode}` : ''}`}
          subtitles={directSubtitles}
          onPlaybackError={handlePlaybackError}
          onClose={() => setPlaying(null)}
        />
      ) : null}

      {playable.length ? (
        <details className="watcher-stream-source-details">
          <summary>Show Available Browser Sources ({playable.length})</summary>
          <div className="watcher-source-list">
            {playable.map((stream, index) => (
              <button key={`${stream.addonId}-${stream.url}-${index}`} className="watcher-source-item" onClick={() => setPlaying(stream)}>
                <span className="watcher-source-quality">{stream.quality || 'AUTO'}</span>
                <span className="watcher-source-copy">
                  <strong>{stream.addonName}</strong>
                  <small>{stream.isHls ? 'HLS' : 'Direct HTTP'}</small>
                </span>
                <Icon name="play" size={15} />
              </button>
            ))}
          </div>
        </details>
      ) : null}

      <div className="watcher-stream-addon-footnote">
        {addons.filter((addon) => addon.enabled && addon.manifestUrl).length} enabled addon{addons.filter((addon) => addon.enabled && addon.manifestUrl).length === 1 ? '' : 's'} checked.
        Watcher skips addons that do not declare the requested resource or type.
      </div>
    </section>
  )
}
