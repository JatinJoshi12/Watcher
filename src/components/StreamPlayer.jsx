import { useEffect, useRef, useState } from 'react'

const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js'

function isHls(url) {
  return /\.m3u8(?:$|[?#])/i.test(String(url || ''))
}

function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls)
  if (window.__watcherHlsPromise) return window.__watcherHlsPromise
  window.__watcherHlsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-watcher-hls]')
    if (existing) {
      existing.addEventListener('load', () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS Library Failed To Initialize.')), { once: true })
      existing.addEventListener('error', () => reject(new Error('HLS Library Failed To Load.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = HLS_CDN
    script.async = true
    script.dataset.watcherHls = 'true'
    script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('HLS Library Failed To Initialize.'))
    script.onerror = () => reject(new Error('HLS Library Failed To Load.'))
    document.head.appendChild(script)
  })
  return window.__watcherHlsPromise
}

async function subtitleSource(track) {
  const url = String(track?.url || '')
  if (!url || /\.vtt(?:$|[?#])/i.test(url)) return { ...track, src: url, revoke: null }
  try {
    const response = await fetch(url, { headers: { Accept: 'text/vtt,text/plain,*/*' } })
    if (!response.ok) throw new Error('Subtitle Fetch Failed')
    const text = await response.text()
    const vtt = /^\s*WEBVTT/i.test(text) ? text : `WEBVTT\n\n${text.replace(/,(\d{3})/g, '.$1')}`
    const objectUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }))
    return { ...track, src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) }
  } catch {
    return { ...track, src: url, revoke: null }
  }
}

export default function StreamPlayer({ playbackKey = '', streams = [], subtitleTracks = [], discoveryComplete = false, autoStart = false, onSuccess, onAllFailed }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const attemptedRef = useRef(new Set())
  const activeUrlRef = useRef('')
  const startingRef = useRef(false)
  const listenersRef = useRef([])
  const userRequestedRef = useRef(false)
  const lastStreamSignatureRef = useRef('')
  const stallTimerRef = useRef(null)
  const startTimerRef = useRef(null)
  const [status, setStatus] = useState('searching')
  const [activeStream, setActiveStream] = useState(null)
  const [preparedSubtitles, setPreparedSubtitles] = useState([])
  const [mutedFallback, setMutedFallback] = useState(false)

  useEffect(() => {
    let active = true
    let createdTracks = []
    Promise.all((subtitleTracks || []).slice(0, 8).map(subtitleSource)).then((tracks) => {
      createdTracks = tracks.filter((track) => track?.src)
      if (active) setPreparedSubtitles(createdTracks)
      else createdTracks.forEach((track) => track.revoke?.())
    })
    return () => {
      active = false
      createdTracks.forEach((track) => track.revoke?.())
    }
  }, [subtitleTracks])

  const cleanup = () => {
    if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current)
    if (startTimerRef.current) window.clearTimeout(startTimerRef.current)
    stallTimerRef.current = null
    startTimerRef.current = null
    listenersRef.current.forEach(([target, event, handler]) => target.removeEventListener(event, handler))
    listenersRef.current = []
    if (hlsRef.current) {
      try { hlsRef.current.destroy() } catch {}
      hlsRef.current = null
    }
  }

  const chooseNext = () => {
    const candidates = streams.filter((stream) => stream?.url && !attemptedRef.current.has(stream.url))
    if (!candidates.length) return null
    const confident = candidates.filter((stream) => (stream.matchScore ?? 1) >= 0.55)
    return (confident.length ? confident : candidates)[0] || null
  }

  const reportFailure = (stream) => {
    if (stream?.url) attemptedRef.current.add(stream.url)
    activeUrlRef.current = ''
    startingRef.current = false
    cleanup()
    const next = chooseNext()
    if (next) {
      window.setTimeout(() => startStream(next), 30)
      return
    }
    if (!discoveryComplete) {
      setStatus('searching')
      return
    }
    setStatus('error')
    onAllFailed?.()
  }

  const playVideo = async (stream, token) => {
    const video = videoRef.current
    if (!video || activeUrlRef.current !== stream.url || token !== lastStreamSignatureRef.current) return
    try {
      await video.play()
      if (activeUrlRef.current !== stream.url || token !== lastStreamSignatureRef.current) return
      setMutedFallback(Boolean(video.muted))
      setStatus('playing')
      onSuccess?.(stream)
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        video.muted = true
        try {
          await video.play()
          setMutedFallback(true)
          setStatus('playing')
          onSuccess?.(stream)
          return
        } catch {}
      }
      reportFailure(stream)
    }
  }

  const startStream = async (stream) => {
    if (!userRequestedRef.current || !stream?.url || startingRef.current) return
    const video = videoRef.current
    if (!video) return
    startingRef.current = true
    activeUrlRef.current = stream.url
    setActiveStream(stream)
    setStatus('loading')
    const token = `${stream.url}|${Date.now()}`
    lastStreamSignatureRef.current = token

    cleanup()
    const onPlaying = () => {
      if (activeUrlRef.current === stream.url) {
        startingRef.current = false
        if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current)
        setStatus('playing')
        onSuccess?.(stream)
      }
    }
    const onWaiting = () => {
      if (activeUrlRef.current !== stream.url) return
      setStatus('buffering')
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current)
      stallTimerRef.current = window.setTimeout(() => reportFailure(stream), 15000)
    }
    const onError = () => reportFailure(stream)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('stalled', onWaiting)
    video.addEventListener('error', onError)

    listenersRef.current.push(
      [video, 'playing', onPlaying],
      [video, 'waiting', onWaiting],
      [video, 'stalled', onWaiting],
      [video, 'error', onError],
    )

    try {
      if (isHls(stream.url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await loadHls()
        if (activeUrlRef.current !== stream.url) return
        if (!Hls.isSupported()) throw new Error('HLS Is Not Supported In This Browser.')
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 45,
          maxMaxBufferLength: 120,
          backBufferLength: 20,
          maxBufferHole: 0.5,
          startFragPrefetch: true,
          capLevelToPlayerSize: true,
          abrBandWidthFactor: 0.92,
          abrBandWidthUpFactor: 0.7,
        })
        hlsRef.current = hls
        hls.on(Hls.Events.MANIFEST_PARSED, () => playVideo(stream, token))
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) reportFailure(stream)
        })
        hls.loadSource(stream.url)
        hls.attachMedia(video)
      } else {
        video.src = stream.url
        video.preload = 'auto'
        video.load()
        startTimerRef.current = window.setTimeout(() => {
          if (activeUrlRef.current === stream.url && video.readyState < 2) reportFailure(stream)
        }, 12000)

        if (video.readyState >= 3) {
          await playVideo(stream, token)
        } else {
          await new Promise((resolve, reject) => {
            let settled = false
            const finish = (fn) => {
              if (settled) return
              settled = true
              video.removeEventListener('canplay', onCanPlay)
              video.removeEventListener('error', onLoadError)
              fn()
            }
            const onCanPlay = () => finish(resolve)
            const onLoadError = () => finish(() => reject(new Error('Video Source Failed To Load.')))
            video.addEventListener('canplay', onCanPlay, { once: true })
            video.addEventListener('error', onLoadError, { once: true })
          })
          if (activeUrlRef.current === stream.url) await playVideo(stream, token)
        }
      }
    } catch {
      reportFailure(stream)
    }

  }

  useEffect(() => {
    attemptedRef.current.clear()
    activeUrlRef.current = ''
    startingRef.current = false
    lastStreamSignatureRef.current = ''
    setActiveStream(null)
    setMutedFallback(false)
    setStatus('searching')
    cleanup()
    const video = videoRef.current
    if (video) {
      try { video.removeAttribute('src') } catch {}
      try { video.load() } catch {}
    }
  }, [playbackKey])

  useEffect(() => {
    if (!autoStart) return
    userRequestedRef.current = true
    if (!activeUrlRef.current && streams.length) {
      const next = chooseNext()
      if (next) startStream(next)
    }
  }, [autoStart, streams])

  useEffect(() => {
    if (!userRequestedRef.current || activeUrlRef.current || !streams.length) return
    const next = chooseNext()
    if (next) startStream(next)
    else if (discoveryComplete) setStatus('error')
  }, [streams, discoveryComplete])

  useEffect(() => () => {
    cleanup()
    attemptedRef.current.clear()
    activeUrlRef.current = ''
    userRequestedRef.current = false
  }, [])

  return (
    <div className="watcher-one-click-player">
      <div className="watcher-one-click-video-shell">
        <video ref={videoRef} controls playsInline preload="auto" className="watcher-one-click-video">
          {preparedSubtitles.map((track) => (
            <track key={track.id} kind="subtitles" srcLang={track.lang} label={track.label} src={track.src} />
          ))}
        </video>
        {status !== 'playing' ? (
          <div className="watcher-one-click-overlay">
            {status === 'searching' ? 'Finding A Working Source…' : status === 'buffering' ? 'Buffering…' : status === 'error' ? 'Unable To Start Playback.' : 'Starting Playback…'}
          </div>
        ) : null}
      </div>
      {mutedFallback ? <button className="watcher-one-click-sound" type="button" onClick={() => {
        const video = videoRef.current
        if (!video) return
        video.muted = false
        video.play().then(() => setMutedFallback(false)).catch(() => {})
      }}>Enable Sound</button> : null}
    </div>
  )
}
