import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Icon } from './Icon'

const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js'

function isHls(url) {
  return /\.m3u8(?:$|[?#])/i.test(String(url || ''))
}

function isLikelyBrowserVideo(url) {
  return /^(https?:)\/\//i.test(String(url || ''))
}

function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls)
  if (window.__watcherHlsPromise) return window.__watcherHlsPromise

  window.__watcherHlsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-watcher-hls]')
    if (existing) {
      existing.addEventListener('load', () => (window.Hls ? resolve(window.Hls) : reject(new Error('HLS Library Loaded Without A Usable API.'))), { once: true })
      existing.addEventListener('error', () => reject(new Error('Unable To Load HLS Playback Support.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = HLS_CDN
    script.async = true
    script.dataset.watcherHls = 'true'
    script.onload = () => (window.Hls ? resolve(window.Hls) : reject(new Error('HLS Library Loaded Without A Usable API.')))
    script.onerror = () => reject(new Error('Unable To Load HLS Playback Support.'))
    document.head.appendChild(script)
  })

  return window.__watcherHlsPromise
}

function convertSrtToVtt(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const body = normalized
    .split('\n')
    .map((line) => line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'))
    .join('\n')
  return `WEBVTT\n\n${body}`
}

async function prepareSubtitleTrack(track) {
  const url = String(track?.url || '')
  if (!url) return null
  const lower = url.toLowerCase()
  const directVtt = track.format === 'vtt' || /\.vtt(?:$|[?#])/.test(lower)
  if (directVtt) return { ...track, src: url, revoke: null }

  try {
    const response = await fetch(url, { headers: { Accept: 'text/vtt,text/plain,*/*' } })
    if (!response.ok) throw new Error(`Subtitle File Failed (${response.status})`)
    const text = await response.text()
    const vtt = /^\s*WEBVTT/i.test(text) ? text : convertSrtToVtt(text)
    const objectUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }))
    return { ...track, src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) }
  } catch {
    return { ...track, src: url, revoke: null }
  }
}

const StreamPlayer = forwardRef(function StreamPlayer({ streams = [], subtitleTracks = [], visible = false, onClose, onSuccess, onAllFailed }, ref) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const listenersRef = useRef([])
  const pendingPlayRef = useRef(null)
  const activeIndexRef = useRef(0)
  const activeUrlRef = useRef('')
  const startedRef = useRef(false)
  const startupTimerRef = useRef(null)
  const stallTimerRef = useRef(null)
  const [activeStream, setActiveStream] = useState(streams[0] || null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [preparedSubtitles, setPreparedSubtitles] = useState([])

  useEffect(() => {
    let active = true
    Promise.all((subtitleTracks || []).slice(0, 8).map(prepareSubtitleTrack)).then((tracks) => {
      if (active) setPreparedSubtitles(tracks.filter(Boolean))
    }).catch(() => {
      if (active) setPreparedSubtitles([])
    })
    return () => { active = false }
  }, [subtitleTracks])

  const clearTimers = () => {
    if (startupTimerRef.current) window.clearTimeout(startupTimerRef.current)
    if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current)
    startupTimerRef.current = null
    stallTimerRef.current = null
  }

  const cleanupMedia = ({ pauseVideo = false, resetVideo = true } = {}) => {
    clearTimers()
    const video = videoRef.current
    const hls = hlsRef.current
    hlsRef.current = null
    if (hls) hls.destroy()
    listenersRef.current.forEach(([target, event, handler]) => target.removeEventListener(event, handler))
    listenersRef.current = []
    if (video && resetVideo) {
      const pending = pendingPlayRef.current
      if (pending?.catch) pending.catch(() => {})
      pendingPlayRef.current = null
      if (pauseVideo) { try { video.pause() } catch { /* cleanup */ } }
      video.removeAttribute('src')
      try { video.load() } catch { /* cleanup */ } 
    }
  }

  const startSource = async (index) => {
    const video = videoRef.current
    const candidate = streams[index]
    if (!video || !candidate?.url || !isLikelyBrowserVideo(candidate.url)) {
      handleFailure('This Source Is Not A Browser Media URL.', index)
      return
    }

    activeIndexRef.current = index
    activeUrlRef.current = candidate.url
    setActiveStream(candidate)
    setStatus('loading')
    setError('')
    // Switching sources must not call pause()/load() on the old media element
    // while a previous play() promise is pending. That was causing the Chrome
    // "play() request was interrupted by pause()" loop.
    cleanupMedia({ resetVideo: false })

    const fail = (message) => handleFailure(message, index)

    const markPlaying = () => {
      clearTimers()
      setStatus('playing')
      onSuccess?.(candidate)
    }

    const markReady = async () => {
      if (activeIndexRef.current !== index || !startedRef.current) return
      setStatus('ready')
      try {
        const promise = video.play()
        pendingPlayRef.current = promise
        await promise
        if (activeIndexRef.current === index && startedRef.current) markPlaying()
      } catch (cause) {
        pendingPlayRef.current = null
        if (cause?.name === 'NotAllowedError') {
          // Browser autoplay policy: keep this source alive and let the native
          // video controls take the click rather than failing over unnecessarily.
          setStatus('ready')
          setError('Press Play In The Video Controls To Start Playback.')
          return
        }
        fail('This Source Failed To Start In Your Browser.')
      }
    }

    const handlePlaying = () => markPlaying()
    const handleWaiting = () => {
      if (activeIndexRef.current !== index || !startedRef.current) return
      setStatus('buffering')
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current)
      stallTimerRef.current = window.setTimeout(() => {
        if (activeIndexRef.current === index && startedRef.current) {
          fail('Source Stalled For Too Long. Trying Another Source…')
        }
      }, 15000)
    }
    const handleCanPlay = () => {
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current)
      if (startedRef.current) setStatus('ready')
    }
    const handleError = () => fail('This Source Failed To Load In Your Browser.')

    video.addEventListener('playing', handlePlaying)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('stalled', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)
    listenersRef.current.push(
      [video, 'playing', handlePlaying],
      [video, 'waiting', handleWaiting],
      [video, 'stalled', handleWaiting],
      [video, 'canplay', handleCanPlay],
      [video, 'error', handleError],
    )

    startupTimerRef.current = window.setTimeout(() => {
      if (activeIndexRef.current === index && startedRef.current && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        fail('Source Took Too Long To Start. Trying Another Source…')
      }
    }, 14000)

    try {
      if (isHls(candidate.url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await loadHls()
        if (!Hls.isSupported()) throw new Error('This Browser Does Not Support HLS Playback.')
        if (activeIndexRef.current !== index || !startedRef.current) return
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 45,
          maxMaxBufferLength: 120,
          backBufferLength: 30,
          startFragPrefetch: true,
          maxBufferHole: 0.25,
          capLevelToPlayerSize: true,
        })
        hlsRef.current = hls
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (activeIndexRef.current !== index || !startedRef.current) return
          markReady()
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data?.fatal || activeIndexRef.current !== index) return
          fail('This HLS Source Failed To Load.')
        })
        hls.loadSource(candidate.url)
        hls.attachMedia(video)
        return
      }

      // For direct HTTP media, attach the source and request playback in the
      // same user-initiated call stack. Waiting for loadedmetadata first can
      // lose browser user activation and trigger autoplay rejection.
      video.src = candidate.url
      video.load()
      await markReady()
    } catch (cause) {
      fail(cause?.message || 'This Source Could Not Be Started.')
    }
  }

  const handleFailure = (message, index) => {
    if (!startedRef.current || index !== activeIndexRef.current) return
    clearTimers()
    const currentUrl = activeUrlRef.current
    const currentIndex = streams.findIndex((stream) => stream.url === currentUrl)
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : index + 1

    if (nextIndex < streams.length) {
      setError(message)
      window.setTimeout(() => {
        if (startedRef.current && activeUrlRef.current === currentUrl) startSource(nextIndex)
      }, 100)
      return
    }
    setStatus('error')
    setError('All Browser-Compatible Sources Failed.')
    onAllFailed?.()
  }

  useImperativeHandle(ref, () => ({
    start() {
      startedRef.current = true
      activeIndexRef.current = 0
      activeUrlRef.current = ''
      setError('')
      startSource(0)
    },
    stop() {
      startedRef.current = false
      activeUrlRef.current = ''
      cleanupMedia({ pauseVideo: true, resetVideo: true })
      setStatus('idle')
    },
  }), [streams, onAllFailed, onSuccess])

  useEffect(() => {
    const activeUrl = activeUrlRef.current
    if (startedRef.current && activeUrl && streams.some((stream) => stream.url === activeUrl)) {
      const activeIndex = streams.findIndex((stream) => stream.url === activeUrl)
      activeIndexRef.current = activeIndex
      setActiveStream(streams[activeIndex])
      return undefined
    }

    if (!startedRef.current) {
      setActiveStream(streams[0] || null)
      activeIndexRef.current = 0
      setStatus('idle')
      setError('')
      return undefined
    }

    startedRef.current = false
    activeUrlRef.current = ''
    activeIndexRef.current = 0
    cleanupMedia({ pauseVideo: true, resetVideo: true })
    setActiveStream(streams[0] || null)
    setStatus('idle')
    setError('')
    return undefined
  }, [streams])

  useEffect(() => () => cleanupMedia({ pauseVideo: true, resetVideo: true }), [])

  const selectSubtitle = (event) => {
    const value = event.target.value
    const video = videoRef.current
    if (!video) return
    Array.from(video.textTracks).forEach((track) => {
      track.mode = value && track.language === value ? 'showing' : 'disabled'
    })
  }

  if (!streams.length) return null

  return (
    <section className={`watcher-stream-player ${visible ? 'is-visible' : 'is-hidden'}`} aria-hidden={!visible}>
      <div className="watcher-stream-player-header">
        <div>
          <span className="watcher-kicker">NOW PLAYING</span>
          <h2>{activeStream?.title || 'Starting Stream…'}</h2>
          <p>{activeStream?.addonName || ''}{activeStream?.kind ? ` · ${activeStream.kind.toUpperCase()}` : ''}</p>
        </div>
        {onClose ? <button className="watcher-square-action" type="button" onClick={onClose} aria-label="Close Player"><Icon name="close" size={16} /></button> : null}
      </div>

      <div className="watcher-video-shell">
        <video ref={videoRef} className="watcher-video" controls playsInline preload="auto">
          {preparedSubtitles.map((track) => <track key={track.id} kind="subtitles" srcLang={track.lang} label={track.label} src={track.src} />)}
        </video>
        {status === 'loading' ? <div className="watcher-video-overlay">Starting Stream…</div> : null}
        {status === 'buffering' ? <div className="watcher-video-overlay">Buffering…</div> : null}
        {status === 'error' ? <div className="watcher-video-overlay">No Working Browser Source Found.</div> : null}
      </div>

      <div className="watcher-player-toolbar">
        <span>{streams.length} browser source{streams.length === 1 ? '' : 's'} queued</span>
        {preparedSubtitles.length ? (
          <label>
            Subtitles
            <select defaultValue="" onChange={selectSubtitle}>
              <option value="">Off</option>
              {preparedSubtitles.map((track) => <option key={track.id} value={track.lang}>{track.label}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {error ? <div className="watcher-stream-player-error"><strong>{error}</strong><span>Watcher will continue through the available browser sources.</span></div> : null}
    </section>
  )
})

export default StreamPlayer
