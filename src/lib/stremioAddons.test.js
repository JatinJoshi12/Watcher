import { describe, expect, it } from 'vitest'
import {
  buildResourceUrl,
  getPrimaryPlayableSource,
  normalizeStream,
  supportsResource,
} from './stremioAddons'

describe('Stremio addon helpers', () => {
  it('preserves configured manifest paths and query parameters', () => {
    const manifest = 'https://example.test/config/abc/manifest.json?mode=browser'
    expect(buildResourceUrl(manifest, 'stream', 'series', 'tt1234567:2:5')).toBe(
      'https://example.test/config/abc/stream/series/tt1234567:2:5.json?mode=browser',
    )
  })

  it('honors declared resource types and id prefixes', () => {
    const manifest = {
      resources: [
        { name: 'stream', types: ['movie', 'series'], idPrefixes: ['tt'] },
      ],
    }

    expect(supportsResource(manifest, 'stream', 'movie', 'tt123')).toBe(true)
    expect(supportsResource(manifest, 'stream', 'series', 'tt123:1:1')).toBe(true)
    expect(supportsResource(manifest, 'stream', 'movie', 'kitsu:123')).toBe(false)
  })

  it('accepts direct HTTP and HLS sources and rejects torrent-only results', () => {
    const addon = { id: 'test', name: 'Test Addon' }
    const direct = normalizeStream(
      { title: '1080p', url: 'https://media.test/movie.mp4' },
      addon,
    )
    const hls = normalizeStream(
      { title: '1080p HLS', url: 'https://media.test/master.m3u8', behaviorHints: { notWebReady: true } },
      addon,
    )
    const torrent = normalizeStream(
      { title: '1080p', infoHash: 'abcdef', behaviorHints: { notWebReady: true } },
      addon,
    )

    expect(direct.browserReady).toBe(true)
    expect(hls.browserReady).toBe(true)
    expect(torrent.browserReady).toBe(false)
  })

  it('returns the highest ranked browser source', () => {
    const sources = [
      normalizeStream({ title: '720p', url: 'https://media.test/720.mp4' }, { name: 'A' }),
      normalizeStream({ title: '1080p', url: 'https://media.test/1080.mp4' }, { name: 'B' }),
    ]

    expect(getPrimaryPlayableSource(sources).quality).toBe('1080p')
  })
})
