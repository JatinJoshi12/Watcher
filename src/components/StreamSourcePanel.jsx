import { useEffect, useMemo, useState } from 'react'
import { getConfiguredAddons, resolveBrowserStreams } from '../lib/stremioAddons'
import { getExternalIds } from '../lib/tmdb'
import StreamPlayer from './StreamPlayer'
import { Icon } from './Icon'

export default function StreamSourcePanel({ item, notify }) {
  const [loading, setLoading] = useState(false)
  const [sources, setSources] = useState([])
  const [errors, setErrors] = useState([])
  const [playerOpen, setPlayerOpen] = useState(false)
  const [addons] = useState(() => getConfiguredAddons())

  const enabled = useMemo(() => addons.filter((addon) => addon.enabled), [addons])

  const findSources = async () => {
    setLoading(true)
    setSources([])
    setErrors([])
    try {
      const external = await getExternalIds(item.tmdb_id, item.type)
      if (!external?.imdb_id) throw new Error('No IMDb ID could be resolved for this title.')
      const videoId = item.type === 'series' && item.current_season && item.current_episode
        ? `${external.imdb_id}:${item.current_season}:${item.current_episode}`
        : external.imdb_id
      const result = await resolveBrowserStreams({
        type: item.type === 'series' ? 'series' : 'movie',
        videoId,
        addons: enabled,
      })
      setSources(result.streams)
      setErrors(result.errors)
      if (!result.streams.length) notify?.('No browser-playable source is currently available.', 'error')
    } catch (error) {
      notify?.(error.message || 'Unable To Find Streams.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    findSources()
    // Deliberately scan once when this title opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  return (
    <section className="watcher-stream-section">
      <div className="watcher-stream-section-head">
        <div>
          <span className="watcher-kicker">STREAMING</span>
          <h2>One Click Watch</h2>
          <p>{loading ? 'Finding a browser-playable source…' : sources.length ? `${sources.length} source${sources.length === 1 ? '' : 's'} ready.` : 'No direct browser source found yet.'}</p>
        </div>
        <button className="watcher-primary-button watcher-glow-button" type="button" onClick={() => setPlayerOpen(true)} disabled={!sources.length || loading}>
          <Icon name="play" size={16} />
          Play
        </button>
      </div>

      {loading ? <div className="watcher-stream-loading">Checking enabled addons…</div> : null}

      {!loading && sources.length ? (
        <div className="watcher-stream-source-list">
          {sources.slice(0, 6).map((source, index) => (
            <div className="watcher-stream-source" key={source.stream.url || index}>
              <div>
                <strong>{source.stream.title || 'Playable Source'}</strong>
                <span>{source.addon.name} · {source.classification.kind.toUpperCase()}</span>
              </div>
              {index === 0 ? <span className="watcher-stream-best">AUTO PICK</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {errors.length ? <div className="watcher-stream-errors">Some addons did not respond: {errors.slice(0, 2).join(' · ')}</div> : null}

      {playerOpen ? <StreamPlayer sources={sources} title={item.title} onClose={() => setPlayerOpen(false)} /> : null}
    </section>
  )
}
