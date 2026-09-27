const ADDON_STORAGE_KEY = 'watcher_stream_addons_v1'
const LEGACY_KEYS = [
  'watcher_stream_addons',
  'watcher_addons',
  'watcher-stremio-addons',
  'watcher_stream_addons_v2',
  'watcher_stremio_addons',
  'watcher_addon_manifests',
]

const DEFAULT_ADDONS = [
  {
    id: 'showbox',
    name: 'Showbox',
    manifestUrl: 'https://showbox.codiv.dpdns.org/manifest.json',
    priority: 400,
    kind: 'stream',
    enabled: true,
  },
  {
    id: 'hdhub',
    name: 'HdHub',
    manifestUrl: 'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyIsImNhdGFsb2dzIjoiIn0/manifest.json',
    priority: 500,
    kind: 'stream',
    enabled: true,
  },
  {
    id: 'webstreamrmbg',
    name: 'WebStreamrMBG',
    manifestUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/%7B%22multi%22%3A%22on%22%7D/manifest.json',
    priority: 300,
    kind: 'stream',
    enabled: true,
  },
  {
    id: 'flix-streams-free',
    name: 'Flix-Streams Free',
    manifestUrl: 'https://free.flixnest.app/eNqNUdFuwjAM_Jc8UwkVxEN_ZUJWSNzVwkkqxynapv37AoXBCg97inLnu1zOXwYwZ4xKloFpQsCp3jJY5nQCz1kFbcgQUU9JjqZTKbgy0AsiZDdgsKYz7brdrXdt28zqpidWlGZM-XxMG7MydytnFd-TEGbTve3_MIONERlm-RNN0XHxCNYXVtP1lnONgtEeGGF7HPxQDreAV9Rb4o-QlFJcMjfbBf6yjv_MPJTlSdDpQnSJty2_6AsPyGMSvf6bYta6BSBfC64FPowpBYQ-SbB6Ln87PNOfKWLlRkkTeRTg5CzXsVE0UAnzozpB2BTIqYi7bONettl__wDqFspC/manifest.json',
    priority: 200,
    kind: 'stream',
    enabled: true,
  },
]

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function normalizeAddon(addon, fallbackIndex = 0) {
  if (!addon || typeof addon !== 'object') return null
  const manifestUrl = String(addon.manifestUrl || addon.url || '').trim()
  if (!/^https?:\/\//i.test(manifestUrl)) return null
  const id = String(addon.id || `custom-${fallbackIndex}-${manifestUrl}`).trim()
  return {
    id,
    name: String(addon.name || `Addon ${fallbackIndex + 1}`).trim(),
    manifestUrl,
    priority: Number.isFinite(Number(addon.priority)) ? Number(addon.priority) : 0,
    kind: addon.kind === 'subtitle' ? 'subtitle' : 'stream',
    enabled: addon.enabled !== false,
  }
}

function readStoredAddons() {
  const storage = safeStorage()
  if (!storage) return []

  const current = storage.getItem(ADDON_STORAGE_KEY)
  if (current) {
    try {
      const parsed = JSON.parse(current)
      if (Array.isArray(parsed)) return parsed.map(normalizeAddon).filter(Boolean)
    } catch {
      // Fall through to legacy migration.
    }
  }

  for (const key of LEGACY_KEYS) {
    const raw = storage.getItem(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      const values = Array.isArray(parsed) ? parsed : []
      const migrated = values.map(normalizeAddon).filter(Boolean)
      if (migrated.length) {
        storage.setItem(ADDON_STORAGE_KEY, JSON.stringify(migrated))
        return migrated
      }
    } catch {
      // Ignore malformed legacy state.
    }
  }

  return []
}

function getPenguManifest() {
  const envUrl = String(import.meta.env?.VITE_PENGUPLAY_MANIFEST_URL || '').trim()
  if (envUrl) return envUrl

  const storage = safeStorage()
  if (!storage) return ''
  return String(storage.getItem('watcher_pengupay_manifest_url') || storage.getItem('watcher_penguplay_manifest_url') || '').trim()
}

export function getStreamAddons() {
  const stored = readStoredAddons()
  const combined = [...DEFAULT_ADDONS, ...stored]
  const penguManifest = getPenguManifest()
  if (penguManifest) {
    combined.unshift({
      id: 'penguplay',
      name: 'PenguPlay',
      manifestUrl: penguManifest,
      priority: 600,
      kind: 'stream',
      enabled: true,
    })
  }

  const seen = new Set()
  return combined
    .map(normalizeAddon)
    .filter(Boolean)
    .filter((addon) => {
      if (seen.has(addon.manifestUrl)) return false
      seen.add(addon.manifestUrl)
      return true
    })
    .sort((a, b) => b.priority - a.priority)
}

export function getAllConfiguredAddons() {
  return getStreamAddons()
}

export function saveStreamAddons(addons) {
  const storage = safeStorage()
  if (!storage) return
  const normalized = (Array.isArray(addons) ? addons : []).map(normalizeAddon).filter(Boolean)
  storage.setItem(ADDON_STORAGE_KEY, JSON.stringify(normalized))
}

function buildResourceUrl(manifestUrl, resource, type, videoId) {
  const url = new URL(manifestUrl)
  const marker = '/manifest.json'
  const index = url.pathname.lastIndexOf(marker)
  if (index < 0) throw new Error('Addon Manifest URL Must End With /manifest.json.')
  const prefix = url.pathname.slice(0, index)
  url.pathname = `${prefix}/${resource}/${type}/${String(videoId)}`.replace(/\/\/{2,}/g, '/') + '.json'
  return url.toString()
}

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Addon Request Failed (${response.status}).`)
    return await response.json()
  } finally {
    window.clearTimeout(timer)
  }
}

function normalizeQuality(text = '') {
  const value = String(text).toLowerCase()
  if (/2160p|\b4k\b|uhd/.test(value)) return 2160
  if (/1440p/.test(value)) return 1440
  if (/1080p|full\s*hd/.test(value)) return 1080
  if (/720p/.test(value)) return 720
  if (/576p/.test(value)) return 576
  if (/480p|sd/.test(value)) return 480
  return 0
}

function detectKind(stream) {
  const url = String(stream?.url || '').trim()
  if (/\.m3u8(?:$|[?#])/i.test(url)) return 'hls'
  if (url) return 'http'
  if (stream?.externalUrl) return 'external'
  if (stream?.infoHash || stream?.magnet) return 'torrent'
  return 'unknown'
}

export function normalizeStream(stream, addon, index = 0) {
  const url = String(stream?.url || '').trim()
  const kind = detectKind(stream)
  const title = String(stream?.title || stream?.name || 'Stream').trim()
  const behaviorHints = stream?.behaviorHints || {}
  return {
    id: `${addon.id}-${index}-${encodeURIComponent(url || title)}`,
    addonId: addon.id,
    addonName: addon.name,
    addonPriority: Number(addon.priority) || 0,
    title,
    url,
    kind,
    quality: normalizeQuality(`${title} ${stream?.quality || ''}`),
    subtitles: Array.isArray(stream?.subtitles) ? stream.subtitles : [],
    externalUrl: String(stream?.externalUrl || ''),
    infoHash: String(stream?.infoHash || ''),
    fileIdx: stream?.fileIdx,
    behaviorHints,
    notWebReady: Boolean(behaviorHints.notWebReady),
    browserCandidate: /^https?:\/\//i.test(url) && (kind === 'http' || kind === 'hls'),
  }
}

function rankStreams(streams) {
  return [...streams].sort((a, b) => {
    const provider = (b.addonPriority || 0) - (a.addonPriority || 0)
    if (provider) return provider
    const quality = (b.quality || 0) - (a.quality || 0)
    if (quality) return quality
    const hls = Number(b.kind === 'hls') - Number(a.kind === 'hls')
    if (hls) return hls
    return a.addonName.localeCompare(b.addonName)
  })
}

export async function fetchAddonStreams(addon, type, ids, timeoutMs = 7000) {
  const candidates = [...new Set([ids.imdbId, ids.tmdbId != null ? `tmdb:${ids.tmdbId}` : ''].filter(Boolean))]
  let lastError = null

  for (const candidate of candidates) {
    try {
      const url = buildResourceUrl(addon.manifestUrl, 'stream', type, candidate)
      const data = await fetchJson(url, timeoutMs)
      const streams = (Array.isArray(data?.streams) ? data.streams : [])
        .map((stream, index) => normalizeStream(stream, addon, index))
      if (streams.length) return streams
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) throw lastError
  return []
}

export async function findPlayableStreamsProgressive({ addons, type, ids, onUpdate }) {
  const enabled = (addons || [])
    .filter((addon) => addon.enabled && addon.manifestUrl && addon.kind === 'stream')
    .sort((a, b) => Number(b.priority) - Number(a.priority))

  const all = []
  const errors = []
  let completed = 0

  if (!enabled.length) {
    onUpdate?.({ all: [], playable: [], errors: [], completed: 0, total: 0, complete: true })
    return { all: [], playable: [], errors: [], completed: 0, total: 0, complete: true }
  }

  await Promise.all(enabled.map(async (addon) => {
    try {
      const streams = await fetchAddonStreams(addon, type, ids)
      all.push(...streams)
    } catch (error) {
      errors.push({ addon: addon.name, error: error?.message || 'Addon Unavailable.' })
    } finally {
      completed += 1
      const deduped = [...new Map(all.filter((stream) => stream.url).map((stream) => [stream.url, stream])).values()]
      const playable = rankStreams(deduped.filter((stream) => stream.browserCandidate))
      onUpdate?.({
        all: deduped,
        playable,
        errors: [...errors],
        completed,
        total: enabled.length,
        complete: completed === enabled.length,
      })
    }
  }))

  const deduped = [...new Map(all.filter((stream) => stream.url).map((stream) => [stream.url, stream])).values()]
  const playable = rankStreams(deduped.filter((stream) => stream.browserCandidate))
  return { all: deduped, playable, errors, completed, total: enabled.length, complete: true }
}

export async function getAddonManifest(manifestUrl) {
  return fetchJson(manifestUrl, 5000)
}

export function getAddonConfigDefaults() {
  return DEFAULT_ADDONS.map((addon) => ({ ...addon }))
}

export function getManifestResourceUrl(manifestUrl, resource, type, videoId) {
  return buildResourceUrl(manifestUrl, resource, type, videoId)
}
