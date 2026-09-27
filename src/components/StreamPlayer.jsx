import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

let hlsLoader = null

function loadHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls)
  if (hlsLoader) return hlsLoader

  hlsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-watcher-hls]')
    if (existing) {
      existing.addEventListener('load', () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS.js failed to initialize.')), { once: true })
      existing.addEventListener('error', () => reject(new Error('HLS.js could not be loaded.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js'
    script.async = true
    script.dataset.watcherHls = 'true'
    script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS.js failed to initialize.'))
    script.onerror = () => reject(new Error('HLS.js could not be loaded.'))
    document.head.appendChild(script)
  })

  return hlsLoader
}

function guessTrackUrl(url) {
  const value = String(url || '').toLowerCase()
  if (value.includes('.vtt')) return url
  return url
}

function srtToVtt(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r/g, '').trim()
  if (/^WEBVTT(?:\s|$)/i.test(normalized)) return normalized + '\n'
  const body = normalized
    .replace(/^\d+\n/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  return `WEBVTT\n\n${body}\n`
}

async function prepareSubtitle(subtitle) {
  try {
    const response = await fetch(subtitle.url, { signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined })
    if (!response.ok) throw new Error(`Subtitle HTTP ${response.status}`)
    const text = await response.text()
    const blob = new Blob([srtToVtt(text)], { type: 'text/vtt' })
    return { ...subtitle, preparedUrl: URL.createObjectURL(blob) }
  } catch {
    return { ...subtitle, preparedUrl: guessTrackUrl(subtitle.url) }
  }
}

export default function StreamPlayer({ stream, title, subtitles = [], onPlaybackError, onClose }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const stallTimerRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [hlsLoading, setHlsLoading] = useState(false)
  const [preparedSubtitles, setPreparedSubtitles] = useState([])

  useEffect(() => {
    let active = true
    let blobUrls = []
    setPreparedSubtitles([])
    Promise.all((subtitles || []).map((subtitle) => prepareSubtitle(subtitle)))
      .then((prepared) => {
        if (!active) return
        blobUrls = prepared.map((subtitle) => subtitle.preparedUrl).filter((url) => String(url).startsWith('blob:'))
        setPreparedSubtitles(prepared)
      })
      .catch(() => {
        if (active) setPreparedSubtitles(subtitles || [])
      })
    return () => {
      active = false
      blobUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [subtitles])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream?.url) return undefined

    setError('')
    setReady(false)
    setHlsLoading(false)

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (stallTimerRef.current) {
      window.clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }

    const isHls = stream.isHls || /\.m3u8(?:$|[?#])/i.test(stream.url)
    let cancelled = false

    const begin = async () => {
      try {
        if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
          setHlsLoading(true)
          const Hls = await loadHlsJs()
          if (cancelled) return
          if (!Hls.isSupported()) throw new Error('This browser cannot play HLS streams.')
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
          hlsRef.current = hls
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data?.fatal) {
              setError(data?.details || 'HLS Playback Failed.')
              onPlaybackError?.(stream)
            }
          })
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return
            setReady(true)
            video.muted = true
            video.play().catch((playError) => {
              if (playError?.name === 'NotAllowedError') {
                setError('The browser blocked automatic playback. Press Play in the video controls.')
              } else {
                setError(playError?.message || 'Playback could not start.')
                onPlaybackError?.(stream)
              }
            })
          })
          hls.loadSource(stream.url)
          hls.attachMedia(video)
        } else {
          video.src = stream.url
          video.load()
          video.muted = true
          setHlsLoading(false)
          setReady(true)
          video.play().catch((playError) => {
            if (playError?.name === 'NotAllowedError') {
              setError('The browser blocked automatic playback. Press Play in the video controls.')
            } else {
              setError(playError?.message || 'Playback could not start.')
              onPlaybackError?.(stream)
            }
          })
        }
      } catch (playbackError) {
        if (cancelled) return
        setError(playbackError?.message || 'Unable to start playback.')
        onPlaybackError?.(stream)
      }
    }

    const onLoaded = () => {
      setReady(true)
      if (stallTimerRef.current) {
        window.clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }
    const onError = () => {
      setError('This source could not be played in the browser.')
      onPlaybackError?.(stream)
    }
    const onWaiting = () => {
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current)
      stallTimerRef.current = window.setTimeout(() => {
        setError('This source stalled. Trying another source…')
        onPlaybackError?.(stream)
      }, 9000)
    }
    const onPlaying = () => {
      onLoaded()
      try {
        video.muted = false
        video.defaultMuted = false
        video.volume = 1
      } catch {
        // Browser may keep audio muted until the user interacts.
      }
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('canplay', onLoaded)
    video.addEventListener('error', onError)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    begin()

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('canplay', onLoaded)
      video.removeEventListener('error', onError)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (stallTimerRef.current) {
        window.clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [stream, onPlaybackError])

  if (!stream?.url) return null

  return (
    <section className="watcher-stream-player-panel">
      <div className="watcher-stream-player-head">
        <div>
          <span className="watcher-kicker">NOW PLAYING</span>
          <h2>{title}</h2>
          <div className="watcher-stream-player-source">
            <span>{stream.addonName}</span>
            {stream.quality ? <span>{stream.quality.toUpperCase()}</span> : null}
            {stream.isHls ? <span>HLS</span> : <span>DIRECT</span>}
          </div>
        </div>
        {onClose ? (
          <button className="watcher-square-action" onClick={onClose} aria-label="Close player" title="Close player">
            <Icon name="close" size={17} />
          </button>
        ) : null}
      </div>

      <div className="watcher-video-shell">
        <video
          ref={videoRef}
          className="watcher-video"
          controls
          playsInline
          autoPlay
          muted
          defaultMuted
          preload="auto"
          crossOrigin={stream.isHls ? 'anonymous' : undefined}
        >
          {preparedSubtitles.map((subtitle, index) => (
            <track
              key={`${subtitle.id || subtitle.url}-${index}`}
              kind="subtitles"
              src={subtitle.preparedUrl || guessTrackUrl(subtitle.url)}
              srcLang={subtitle.lang || 'en'}
              label={subtitle.lang || subtitle.addonName || 'Subtitle'}
              default={index === 0}
            />
          ))}
        </video>

        {!ready && !error ? (
          <div className="watcher-player-overlay">
            <div className="watcher-player-loader" />
            <strong>{hlsLoading ? 'Preparing HLS Playback…' : 'Starting Playback…'}</strong>
          </div>
        ) : null}

        {error ? (
          <div className="watcher-player-error">
            <Icon name="close" size={22} />
            <strong>{error}</strong>
            <span>Watcher will use another compatible source when one is available.</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
