const STORAGE_KEY = 'watcher_stream_addons_v3'
const LEGACY_KEYS = ['watcher_stream_addons_v2', 'watcher_stream_addons', 'watcher_addons']
const manifestCache = new Map()
const streamCache = new Map()

export const STREAM_ADDON_DEFINITIONS = [
  {
    id: 'penguplay',
    name: 'PenguPlay',
    description: 'Direct HTTP stream addon. Uses your configured authenticated manifest.',
    kind: 'stream',
    priority: 100,
    manifestUrl: import.meta.env?.VITE_PENGUPLAY_MANIFEST_URL?.trim() || '',
  },
  {
    id: 'showbox',
    name: 'Showbox',
    description: 'Direct HTTP movie and series streams.',
    kind: 'stream',
    priority: 80,
    manifestUrl: 'https://showbox.codiv.dpdns.org/manifest.json',
  },
  {
    id: 'hdhub',
    name: 'HdHub',
    description: 'Movie and series stream addon.',
    kind: 'stream',
    priority: 90,
    manifestUrl: 'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyIsImNhdGFsb2dzIjoiIn0/manifest.json',
  },
  {
    id: 'webstreamrmbg',
    name: 'WebStreamrMBG',
    description: 'HTTP stream addon for movies and series.',
    kind: 'stream',
    priority: 70,
    manifestUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/%7B%22multi%22%3A%22on%22%7D/manifest.json',
  },
  {
    id: 'flix-streams-free',
    name: 'Flix-Streams Free',
    description: 'Movie and series stream addon with HTTP-capable providers.',
    kind: 'stream',
    priority: 60,
    manifestUrl: 'https://free.flixnest.app/eNqNUdFuwjAM_Jc8UwkVxEN_ZUJWSNzVwkkqxynapv37AoXBCg97inLnu1zOXwYwZ4xKloFpQsCp3jJY5nQCz1kFbcgQUU9JjqZTKbgy0AsiZDdgsKYz7brdrXdt28zqpidWlGZM-XxMG7MydytnFd-TEGbTve3_MIONERlm-RNN0XHxCNYXVtP1lnONgtEeGGF7HPxQDreAV9Rb4o-QlFJcMjfbBf6yjv_MPJTlSdDpQnSJty2_6AsPyGMSvf6bYta6BSBfC64FPowpBYQ-SbB6Ln87PNOfKWLlRkkTeRTg5CzXsVEwUAnzozpB2BTIqYi7bONettl__wDqFspC/manifest.json',
  },
  {
    id: 'opensubtitles-pro',
    name: 'OpenSubtitles PRO',
    description: 'English subtitle provider for movies and series.',
    kind: 'subtitles',
    manifestUrl: 'https://opensubtitlesv3-pro.dexter21767.com/eyJsYW5ncyI6WyJlbmdsaXNoIl0sInNvdXJjZSI6ImFsbCIsImFpVHJhbnNsYXRlZCI6dHJ1ZSwiYXV0b0FkanVzdG1lbnQiOmZhbHNlfQ==/manifest.json',
  },
  {
    id: 'watch-next',
    name: 'Watch Next',
    description: 'Recommendation source for related movies and series.',
    kind: 'next',
    manifestUrl: 'https://099757617587-watch-next.baby-beamup.club/manifest.json',
  },
]

function normalizeManifestUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/\/manifest\.json(?:[?#].*)?$/i.test(raw)) return raw
  return `${raw.replace(/\/+$/, '')}/manifest.json`
}

function normalizeStoredAddon(addon, fallback) {
  return {
    ...fallback,
    ...(addon || {}),
    id: fallback.id,
    name: fallback.name,
    description: fallback.description,
    kind: fallback.kind,
    manifestUrl: normalizeManifestUrl(addon?.manifestUrl ?? fallback.manifestUrl),
    priority: Number(fallback.priority) || 0,
    enabled: addon?.enabled !== false,
  }
}

function readStoredAddons() {
  if (typeof window === 'undefined') return []

  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = window.localStorage.getItem(key)
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed) && parsed.length) return parsed
    } catch {
      // Try the next legacy key.
    }
  }
  return []
}

export function getStreamAddons() {
  const saved = readStoredAddons()
  return STREAM_ADDON_DEFINITIONS.map((definition) => {
    const existing = saved.find((addon) => addon?.id === definition.id)
    return normalizeStoredAddon(existing, definition)
  })
}

export function saveStreamAddons(addons) {
  const normalized = STREAM_ADDON_DEFINITIONS.map((definition) => {
    const current = addons.find((addon) => addon?.id === definition.id)
    return normalizeStoredAddon(current, definition)
  })
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function updateStreamAddon(id, patch) {
  return saveStreamAddons(getStreamAddons().map((addon) => (
    addon.id === id ? { ...addon, ...patch } : addon
  )))
}

export function resetStreamAddons() {
  window.localStorage.removeItem(STORAGE_KEY)
  return getStreamAddons()
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`Request Failed (${response.status})`)
  return response.json()
}

export async function fetchAddonManifest(manifestUrl, timeoutMs = 9000) {
  const url = normalizeManifestUrl(manifestUrl)
  if (!url) throw new Error('Manifest URL Is Empty.')
  const cached = manifestCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.manifest

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const manifest = await fetchJson(url, controller.signal)
    manifestCache.set(url, { manifest, expiresAt: Date.now() + 10 * 60 * 1000 })
    return manifest
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Manifest Request Timed Out.')
    if (error instanceof TypeError) throw new Error('Manifest Blocked By Browser CORS Or Network Policy.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function resourceObjects(manifest, name) {
  if (!Array.isArray(manifest?.resources)) return []
  return manifest.resources
    .filter((resource) => typeof resource === 'object' ? resource?.name === name : resource === name)
    .map((resource) => typeof resource === 'string' ? { name: resource } : resource)
}

function supportsIdPrefix(resource, videoId) {
  const prefixes = Array.isArray(resource?.idPrefixes) ? resource.idPrefixes : []
  if (!prefixes.length) return true
  return prefixes.some((prefix) => String(videoId).startsWith(String(prefix)))
}

export function addonSupportsStreams(manifest, type, videoId = '') {
  return resourceObjects(manifest, 'stream').some((resource) => {
    const types = Array.isArray(resource.types) ? resource.types : manifest.types
    const typeOkay = !Array.isArray(types) || types.length === 0 || types.includes(type)
    return typeOkay && supportsIdPrefix(resource, videoId)
  })
}

function hasPrefix(prefixes, value) {
  return prefixes.some((prefix) => String(prefix).toLowerCase() === value)
}

function chooseVideoId(manifest, type, ids) {
  const resource = resourceObjects(manifest, 'stream').find((entry) => {
    const types = Array.isArray(entry.types) ? entry.types : manifest.types
    const typeOkay = !Array.isArray(types) || !types.length || types.includes(type)
    return typeOkay
  })
  const prefixes = Array.isArray(resource?.idPrefixes) && resource.idPrefixes.length
    ? resource.idPrefixes
    : (Array.isArray(manifest?.idPrefixes) ? manifest.idPrefixes : [])

  if (ids.imdbId && (!prefixes.length || prefixes.some((prefix) => ids.imdbId.startsWith(String(prefix))))) {
    return ids.imdbId
  }

  if (ids.tmdbId != null && (hasPrefix(prefixes, 'tmdb') || hasPrefix(prefixes, 'tmdb:'))) {
    return `tmdb:${ids.tmdbId}`
  }

  return ids.imdbId || (ids.tmdbId != null ? `tmdb:${ids.tmdbId}` : '')
}

function encodeVideoId(videoId) {
  return String(videoId)
    .split(':')
    .map((segment) => encodeURIComponent(segment))
    .join(':')
}

export function buildStreamUrl(manifestUrl, type, videoId) {
  const url = new URL(normalizeManifestUrl(manifestUrl))
  url.pathname = `${url.pathname.replace(/\/manifest\.json$/i, '')}/stream/${encodeURIComponent(type)}/${encodeVideoId(videoId)}.json`
  return url.toString()
}

export function buildSubtitlesUrl(manifestUrl, type, videoId) {
  const url = new URL(normalizeManifestUrl(manifestUrl))
  url.pathname = `${url.pathname.replace(/\/manifest\.json$/i, '')}/subtitles/${encodeURIComponent(type)}/${encodeVideoId(videoId)}.json`
  return url.toString()
}

async function fetchStreamResponse(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchJson(url, controller.signal)
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Stream Request Timed Out.')
    if (error instanceof TypeError) throw new Error('Stream Request Blocked By Browser CORS Or Network Policy.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function cacheKey(addon, type, videoId) {
  return `${addon.id}|${addon.manifestUrl}|${type}|${videoId}`
}

function normalizeAddonStreamResult(data, addon, manifest, videoId) {
  const streams = Array.isArray(data?.streams) ? data.streams : []
  return {
    manifest,
    videoId,
    streams: streams.map((stream, index) => normalizeStream(stream, addon, manifest, index)),
  }
}

export async function fetchAddonStreams(addon, type, ids, timeoutMs = 7000) {
  const candidates = [
    ids.imdbId || '',
    ids.tmdbId != null ? `tmdb:${ids.tmdbId}` : '',
  ].filter(Boolean)
  const keyBase = `${addon.id}|${addon.manifestUrl}|${type}|`
  const now = Date.now()

  for (const candidate of candidates) {
    const cached = streamCache.get(`${keyBase}${candidate}`)
    if (cached && cached.expiresAt > now) return cached.result
  }

  // Fast path: try all plausible IDs in parallel. Most addons accept IMDb IDs,
  // while a few configured addons accept a TMDB-prefixed ID instead.
  const attempts = await Promise.allSettled(
    candidates.map((candidate) =>
      fetchStreamResponse(
        buildStreamUrl(addon.manifestUrl, type, candidate),
        Math.min(timeoutMs, 4500),
      ).then((data) => ({ candidate, data }))
    )
  )

  let lastError = null
  for (const attempt of attempts) {
    if (attempt.status !== 'fulfilled') {
      lastError = attempt.reason
      continue
    }
    const { candidate, data } = attempt.value
    if (Array.isArray(data?.streams) && data.streams.length) {
      const result = normalizeAddonStreamResult(data, addon, {}, candidate)
      streamCache.set(`${keyBase}${candidate}`, { result, expiresAt: Date.now() + 20_000 })
      return result
    }
    lastError = new Error('Addon Returned No Streams For This ID.')
  }

  // Compatibility path: inspect the manifest only when the fast path fails.
  const manifest = await fetchAddonManifest(addon.manifestUrl, Math.min(timeoutMs, 6000))
  const videoId = chooseVideoId(manifest, type, ids)
  if (!videoId) throw new Error('No Compatible IMDb/TMDB ID Available For This Addon.')
  if (!addonSupportsStreams(manifest, type, videoId)) {
    throw new Error('Addon Does Not Advertise Stream Resources For This Title Type.')
  }

  try {
    const data = await fetchStreamResponse(buildStreamUrl(addon.manifestUrl, type, videoId), timeoutMs)
    const result = normalizeAddonStreamResult(data, addon, manifest, videoId)
    if (!result.streams.length && lastError) throw lastError
    streamCache.set(`${keyBase}${videoId}`, { result, expiresAt: Date.now() + 20_000 })
    return result
  } catch (error) {
    throw error
  }
}

function qualityScore(stream) {
  const text = `${stream.title || ''} ${stream.name || ''} ${stream.quality || ''}`.toLowerCase()
  if (/(2160p|4k|uhd)/i.test(text)) return 300
  if (/1440p/i.test(text)) return 260
  if (/(1080p|full hd|fhd)/i.test(text)) return 420
  if (/(720p|hd)/i.test(text)) return 340
  if (/576p/i.test(text)) return 120
  if (/480p|sd/i.test(text)) return 100
  return 70
}

function detectKind(stream) {
  const url = typeof stream?.url === 'string' ? stream.url.trim() : ''
  if (url) {
    if (/\.m3u8(?:$|[?#])/i.test(url)) return 'hls'
    if (/\.(?:mkv|avi|flv)(?:$|[?#])/i.test(url)) return 'unsupported-video'
    if (/^https?:\/\//i.test(url)) return 'http'
  }
  if (stream?.ytId) return 'youtube'
  if (stream?.externalUrl) return 'external'
  if (stream?.infoHash || stream?.fileIdx != null || stream?.magnet) return 'torrent'
  return 'unknown'
}

export function normalizeStream(stream, addon, manifest = {}, index = 0) {
  const url = typeof stream?.url === 'string' ? stream.url.trim() : ''
  const behaviorHints = stream?.behaviorHints || {}
  const kind = detectKind(stream)
  const requiresHeaders = Boolean(behaviorHints?.proxyHeaders || behaviorHints?.requestHeaders)
  const explicitlyNotWebReady = Boolean(behaviorHints?.notWebReady)

  return {
    id: `${addon.id}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    addonId: addon.id,
    addonName: manifest.name || addon.name,
    addonPriority: Number(addon.priority) || 0,
    title: stream?.title || stream?.name || 'Stream',
    name: stream?.name || manifest.name || addon.name,
    url,
    externalUrl: typeof stream?.externalUrl === 'string' ? stream.externalUrl : '',
    infoHash: typeof stream?.infoHash === 'string' ? stream.infoHash : '',
    fileIdx: stream?.fileIdx,
    ytId: typeof stream?.ytId === 'string' ? stream.ytId : '',
    behaviorHints,
    subtitles: Array.isArray(stream?.subtitles) ? stream.subtitles : [],
    kind,
    requiresHeaders,
    explicitlyNotWebReady,
    qualityScore: qualityScore(stream),
    browserCandidate: Boolean(
      url
      && /^https?:\/\//i.test(url)
      && kind !== 'unsupported-video'
    ),
  }
}

export function rankBrowserStreams(streams) {
  const seen = new Set()
  return [...streams]
    .filter((stream) => stream.browserCandidate && stream.url)
    .filter((stream) => {
      const key = stream.url.trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => {
      // Provider preference comes first. PenguPlay is intentionally the
      // preferred source, followed by the other direct-stream providers.
      const provider = (b.addonPriority || 0) - (a.addonPriority || 0)
      if (provider) return provider
      const quality = b.qualityScore - a.qualityScore
      if (quality) return quality
      const hls = Number(b.kind === 'hls') - Number(a.kind === 'hls')
      if (hls) return hls
      const headers = Number(a.requiresHeaders) - Number(b.requiresHeaders)
      if (headers) return headers
      return a.addonName.localeCompare(b.addonName)
    })
}

function isTransientAddonError(error) {
  const message = String(error?.message || error || '')
  return /timed out|request failed \((?:408|429|5\d\d)\)|network|cors/i.test(message)
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchAddonWithRetry(addon, type, ids) {
  try {
    return await fetchAddonStreams(addon, type, ids)
  } catch (error) {
    if (!isTransientAddonError(error)) throw error
    await wait(450)
    return fetchAddonStreams(addon, type, ids)
  }
}

export async function findPlayableStreamsProgressive({ addons, type, ids, onAddonResult }) {
  const enabled = addons
    .filter((addon) => addon.enabled && addon.manifestUrl && addon.kind === 'stream')
    .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))

  const streams = []
  const errors = []

  await Promise.allSettled(enabled.map(async (addon) => {
    try {
      const result = await fetchAddonWithRetry(addon, type, ids)
      streams.push(...result.streams)
      onAddonResult?.({ addon, result: result.streams, all: [...streams], errors: [...errors] })
    } catch (error) {
      const entry = { addon: addon.name, error: error?.message || 'Unknown Addon Error.' }
      errors.push(entry)
      onAddonResult?.({ addon, result: [], all: [...streams], errors: [...errors] })
    }
  }))

  const all = [...streams]
  return {
    all,
    playable: rankBrowserStreams(all),
    errors,
  }
}

export async function findPlayableStreams({ addons, type, ids }) {
  return findPlayableStreamsProgressive({ addons, type, ids })
}
