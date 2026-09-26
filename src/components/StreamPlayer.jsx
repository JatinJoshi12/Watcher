import { useEffect, useRef, useState } from 'react'

export default function StreamPlayer({ sources, title, onClose }) {
  const videoRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [message, setMessage] = useState('')
  const source = sources[index]

  useEffect(() => {
    setIndex(0)
    setMessage('')
  }, [sources])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !source?.stream?.url) return undefined

    video.src = source.stream.url
    video.load()
    const playPromise = video.play()
    if (playPromise?.catch) playPromise.catch(() => null)

    const onError = () => {
      if (index + 1 < sources.length) {
        setMessage('This source failed. Trying the next available source…')
        setIndex((value) => value + 1)
      } else {
        setMessage('All browser-playable sources failed in this browser.')
      }
    }

    video.addEventListener('error', onError)
    return () => video.removeEventListener('error', onError)
  }, [index, source, sources.length])

  if (!source) return null

  return (
    <div className="watcher-stream-player-shell">
      <div className="watcher-stream-player-head">
        <div>
          <span className="watcher-kicker">NOW PLAYING</span>
          <h2>{title}</h2>
          <span>{source.addon?.name || 'Stream'} · {source.stream?.title || source.classification.kind}</span>
        </div>
        <button className="watcher-secondary-button" type="button" onClick={onClose}>Close</button>
      </div>
      <video ref={videoRef} className="watcher-stream-player" controls playsInline autoPlay />
      {message ? <div className="watcher-stream-player-message">{message}</div> : null}
    </div>
  )
}
