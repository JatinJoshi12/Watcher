const STORAGE_KEY = 'watcher.stremio.addons.v2'

export const DEFAULT_ADDONS = [
  { id: 'mediafusion', name: 'MediaFusion', manifestUrl: 'https://mediafusion.elfhosted.com/manifest.json', enabled: true, autoPlay: false, note: 'Torrent / Debrid source addon.' },
  { id: 'thepiratebay-plus', name: 'ThePirateBay+', manifestUrl: 'https://thepiratebay-plus.strem.fun/manifest.json', enabled: false, autoPlay: false, note: 'Torrent source addon; not used for automatic browser playback.' },
  { id: 'torrentio', name: 'Torrentio', manifestUrl: 'https://torrentio.strem.fun/manifest.json', enabled: false, autoPlay: false, note: 'Torrent source addon; not used for automatic browser playback.' },
  { id: 'torrentsdb', name: 'TorrentsDB', manifestUrl: 'https://torrentsdb.com/manifest.json', enabled: false, autoPlay: false, note: 'Torrent / Debrid source addon.' },
  { id: 'ilcorsaroviola', name: 'IlCorsaroViola', manifestUrl: 'https://icv.stremio-italia.eu/manifest.json', enabled: false, autoPlay: false, note: 'P2P-oriented source addon.' },
  { id: 'streaming-catalogs', name: 'Streaming Catalogs', manifestUrl: 'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/manifest.json', enabled: true, autoPlay: false, note: 'Catalog discovery only.' },
  { id: 'stremify', name: 'Stremify', manifestUrl: 'https://stremify.elfhosted.com/manifest.json', enabled: true, autoPlay: true, note: 'Stream capability depends on the current instance.' },
  { id: 'bharat-binge', name: 'Bharat Binge', manifestUrl: 'https://bharat-binge.semi-column.workers.dev/manifest.json', enabled: true, autoPlay: false, note: 'Indian catalog discovery.' },
  { id: 'india-streams', name: 'IndiaStreams', manifestUrl: 'https://indiastreams.rdata.in/manifest.json', enabled: true, autoPlay: false, note: 'Indian catalog discovery.' },
  { id: 'tvvoo', name: 'TvVoo', manifestUrl: 'https://tvvoo.hayd.uk/cfg-it-uk-fr/manifest.json', enabled: true, autoPlay: true, note: 'TV channel / HLS addon.' },
  { id: 'audiobookbay', name: 'AudioBookBay', manifestUrl: 'https://audiobookbay-stremio.obamarama.workers.dev/manifest.json', enabled: true, autoPlay: false, note: 'Audiobook catalog and stream addon.' },
  { id: 'aioratings', name: 'AIORatings', manifestUrl: 'https://aioratings.elfhosted.com/manifest.json', enabled: true, autoPlay: false, note: 'Ratings / metadata stream entries, not media playback.' },
  { id: 'marvel', name: 'Marvel Addon', manifestUrl: 'https://addon-marvel.gonp.deno.net/manifest.json', enabled: true, autoPlay: true, note: 'Capability depends on the current instance.' },
  { id: 'flix-streams', name: 'Flix-Streams', manifestUrl: 'https://flixnest.app/flix-streams/manifest.json', enabled: true, autoPlay: true, note: 'HTTP / HLS source addon.' },
  { id: 'free-flix-streams', name: 'Free Flix-Streams', manifestUrl: 'https://free.flixnest.app/manifest.json', enabled: true, autoPlay: true, note: 'HTTP / HLS source addon.' },
]

function safeParse(raw) {
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function getConfiguredAddons() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY) || '[]')
  const byUrl = new Map(saved.map((addon) => [addon.manifestUrl, addon]))
  return DEFAULT_ADDONS.map((addon) => ({ ...addon, ...(byUrl.get(addon.manifestUrl) || {}) }))
    .concat(saved.filter((addon) => !DEFAULT_ADDONS.some((item) => item.manifestUrl === addon.manifestUrl)))
}

export function saveConfiguredAddons(addons) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(addons))
}

export function upsertAddon(addon) {
  const current = getConfiguredAddons()
  const next = current.some((item) => item.manifestUrl === addon.manifestUrl)
    ? current.map((item) => item.manifestUrl === addon.manifestUrl ? { ...item, ...addon } : item)
    : [...current, addon]
  saveConfiguredAddons(next)
  return next
}

export function toggleAddon(manifestUrl, enabled) {
  const next = getConfiguredAddons().map((addon) => addon.manifestUrl === manifestUrl ? { ...addon, enabled } : addon)
  saveConfiguredAddons(next)
  return next
}

export function removeAddon(manifestUrl) {
  const next = getConfiguredAddons().filter((addon) => addon.manifestUrl !== manifestUrl)
  saveConfiguredAddons(next)
  return next
}

export async function fetchManifest(manifestUrl) {
  const response = await fetch(manifestUrl, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Manifest Request Failed (${response.status})`)
  const manifest = await response.json()
  if (!manifest?.id || !manifest?.name) throw new Error('Invalid Stremio manifest.')
  return manifest
}

function streamEndpoint(manifestUrl, type, videoId) {
  const url = new URL(manifestUrl)
  const manifestPath = url.pathname
  const directory = manifestPath.endsWith('/') ? manifestPath : manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1)
  url.pathname = `${directory}stream/${encodeURIComponent(type)}/${encodeURIComponent(videoId)}.json`.replace(/\/+/g, '/')
  url.hash = ''
  return url.toString()
}

export async function fetchStreams(addon, type, videoId) {
  const url = streamEndpoint(addon.manifestUrl, type, videoId)
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${addon.name}: Stream Request Failed (${response.status})`)
  const data = await response.json()
  return Array.isArray(data?.streams) ? data.streams : []
}

function qualityScore(text = '') {
  const value = String(text).toLowerCase()
  if (/8k|4320/.test(value)) return 600
  if (/4k|2160|uhd/.test(value)) return 500
  if (/1440p/.test(value)) return 450
  if (/1080p|full.?hd/.test(value)) return 400
  if (/720p|hd/.test(value)) return 300
  if (/480p|sd/.test(value)) return 200
  return 100
}

export function classifyStream(stream) {
  if (!stream || typeof stream !== 'object') return { kind: 'unknown', browserPlayable: false }
  const url = typeof stream.url === 'string' ? stream.url.trim() : ''
  const externalUrl = typeof stream.externalUrl === 'string' ? stream.externalUrl.trim() : ''
  const ytId = typeof stream.ytId === 'string' ? stream.ytId.trim() : ''
  const notWebReady = Boolean(stream.behaviorHints?.notWebReady)

  if (notWebReady) return { kind: 'not-web-ready', browserPlayable: false }
  if (url && /^https?:\/\//i.test(url)) {
    if (/\.m3u8(?:$|\?)/i.test(url)) return { kind: 'hls', browserPlayable: true }
    if (/\.(mp4|webm|m4v|ogg|ogv)(?:$|\?)/i.test(url)) return { kind: 'video', browserPlayable: true }
    return { kind: 'http', browserPlayable: true }
  }
  if (externalUrl) return { kind: 'external', browserPlayable: false }
  if (ytId) return { kind: 'youtube', browserPlayable: false }
  if (stream.infoHash || (url && /^(magnet:|btih:)/i.test(url))) return { kind: 'torrent', browserPlayable: false }
  return { kind: 'unknown', browserPlayable: false }
}

export function rankBrowserStreams(streams) {
  const seen = new Set()
  return streams
    .map((entry) => {
      const classification = classifyStream(entry.stream)
      const label = `${entry.stream?.title || ''} ${entry.stream?.name || ''} ${entry.addon?.name || ''}`
      return {
        ...entry,
        classification,
        score: (classification.browserPlayable ? 10000 : 0) + qualityScore(label),
      }
    })
    .filter((entry) => {
      if (!entry.classification.browserPlayable) return false
      const key = entry.stream?.url || entry.stream?.externalUrl || entry.stream?.ytId || entry.stream?.infoHash
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.score - a.score)
}

export async function resolveBrowserStreams({ type, videoId, addons, signal }) {
  const enabled = addons.filter((addon) => addon.enabled && addon.autoPlay)
  const settled = await Promise.allSettled(enabled.map(async (addon) => ({
    addon,
    streams: await fetchStreams(addon, type, videoId, signal),
  })))
  const results = []
  const errors = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      for (const stream of result.value.streams) results.push({ addon: result.value.addon, stream })
    } else {
      errors.push(result.reason?.message || 'Addon Request Failed')
    }
  }
  return { streams: rankBrowserStreams(results), errors }
}
