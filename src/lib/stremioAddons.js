const STORAGE_KEY = 'watcher_stremio_addons_v3'
const LEGACY_KEYS = ['watcher_addons', 'watcher_addons_v1', 'watcher_stremio_addons', 'watcher_stremio_addons_v2']
const REQUEST_TIMEOUT_MS = 6000
const manifestCache = new Map()
const MANIFEST_CACHE_MS = 10 * 60 * 1000

const PENGUPLAY_ENV = import.meta.env.VITE_PENGUPLAY_MANIFEST_URL?.trim() || ''

export const DEFAULT_ADDONS = [
  {
    id: 'penguplay',
    name: 'PenguPlay',
    kind: 'stream',
    manifestUrl: PENGUPLAY_ENV,
    requiresConfiguration: true,
    description: 'Authenticated HTTP stream addon. Add your personal manifest URL.',
  },
  {
    id: 'showbox',
    name: 'Showbox',
    kind: 'stream',
    manifestUrl: 'https://showbox.codiv.dpdns.org/manifest.json',
    description: 'Direct HTTP movie and series streams.',
  },
  {
    id: 'hdhub',
    name: 'HdHub',
    kind: 'stream',
    manifestUrl: 'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyIsImNhdGFsb2dzIjoiIn0/manifest.json',
    description: 'Movie and series stream addon.',
  },
  {
    id: 'webstreamr',
    name: 'WebStreamrMBG',
    kind: 'stream',
    manifestUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/%7B%22multi%22%3A%22on%22%7D/manifest.json',
    description: 'HTTP stream addon with multiple provider extractors.',
  },
  {
    id: 'flix-free',
    name: 'Flix-Streams Free',
    kind: 'stream',
    manifestUrl: 'https://free.flixnest.app/eNqNUdFuwjAM_Jc8UwkVxEN_ZUJWSNzVwkkqxynapv37AoXBCg97inLnu1zOXwYwZ4xKloFpQsCp3jJY5nQCz1kFbcgQUU9JjqZTKbgy0AsiZDdgsKYz7brdrXdt28zqpidWlGZM-XxMG7MydytnFd-TEGbTve3_MIONERlm-RNN0XHxCNYXVtP1lnONgtEeGGF7HPxQDreAV9Rb4o-QlFJcMjfbBf6yjv_MPJTlSdDpQnSJty2_6AsPyGMSvf6bYta6BSBfC64FPowpBYQ-SbB6Ln87PNOfKWLlRkkTeRTg5CzXsVE0wUAnzozpB2BTIqYi7bONettl__wDqFspC/manifest.json',
    description: 'Free HTTP/catalog addon.',
  },
  {
    id: 'opensubtitles-pro',
    name: 'OpenSubtitles PRO',
    kind: 'subtitles',
    manifestUrl: 'https://opensubtitlesv3-pro.dexter21767.com/eyJsYW5ncyI6WyJlbmdsaXNoIl0sInNvdXJjZSI6ImFsbCIsImFpVHJhbnNsYXRlZCI6dHJ1ZSwiYXV0b0FkanVzdG1lbnQiOmZhbHNlfQ==/manifest.json',
    description: 'Subtitle provider for movies and series.',
  },
  {
    id: 'watch-next',
    name: 'Watch Next',
    kind: 'next',
    manifestUrl: 'https://099757617587-watch-next.baby-beamup.club/manifest.json',
    description: 'Recommendation-oriented addon declared as a stream resource.',
  },
]

function cleanUrl(value) {
  return String(value || '').trim()
}

function ensureManifestUrl(value) {
  const url = new URL(cleanUrl(value))
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Addon manifest must use HTTP or HTTPS.')
  return url.toString()
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch {
    // Ignore malformed local data.
  }

  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed
    } catch {
      // Continue to the next legacy key.
    }
  }

  return []
}

function writeStored(addons) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(addons))
}

export function getConfiguredAddons() {
  const stored = readStored()
  const byUrl = new Map()

  for (const addon of DEFAULT_ADDONS) {
    if (addon.manifestUrl) byUrl.set(addon.manifestUrl, { ...addon, enabled: true })
    else byUrl.set(addon.id, { ...addon, enabled: false })
  }

  for (const addon of stored) {
    const url = cleanUrl(addon.manifestUrl || addon.baseUrl)
    const normalizedUrl = url && /\/manifest\.json(?:$|[?#])/i.test(url) ? url : (url ? `${url.replace(/\/$/, '')}/manifest.json` : '')
    const key = normalizedUrl || addon.id
    if (!key) continue
    const existing = byUrl.get(key)
    byUrl.set(key, {
      ...(existing || {}),
      ...addon,
      id: addon.id || existing?.id || `addon-${Math.random().toString(36).slice(2, 9)}`,
      manifestUrl: normalizedUrl,
      enabled: addon.enabled !== false,
    })
  }

  const result = [...byUrl.values()]
  writeStored(result)
  return result
}

export function saveConfiguredAddons(addons) {
  writeStored(addons.map((addon) => ({
    ...addon,
    manifestUrl: cleanUrl(addon.manifestUrl || addon.baseUrl),
  })))
}

export function upsertConfiguredAddon(addon) {
  const current = getConfiguredAddons()
  const url = ensureManifestUrl(addon.manifestUrl)
  const index = current.findIndex((item) => item.manifestUrl === url)
  const value = {
    ...addon,
    manifestUrl: url,
    enabled: addon.enabled !== false,
  }
  if (index >= 0) current[index] = { ...current[index], ...value }
  else current.push(value)
  saveConfiguredAddons(current)
  return current
}

export function removeConfiguredAddon(manifestUrl) {
  const current = getConfiguredAddons().filter((addon) => addon.manifestUrl !== manifestUrl)
  saveConfiguredAddons(current)
  return current
}

export function toggleConfiguredAddon(manifestUrl, enabled) {
  const current = getConfiguredAddons().map((addon) => addon.manifestUrl === manifestUrl ? { ...addon, enabled } : addon)
  saveConfiguredAddons(current)
  return current
}

async function fetchJSON(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return { data, finalUrl: response.url || url }
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export async function fetchManifest(manifestUrl) {
  const normalized = ensureManifestUrl(manifestUrl)
  const cached = manifestCache.get(normalized)
  if (cached && Date.now() - cached.timestamp < MANIFEST_CACHE_MS) return cached.value

  const value = await fetchJSON(normalized)
    .then(({ data, finalUrl }) => {
      if (!data || typeof data !== 'object') throw new Error('Addon returned an invalid manifest.')
      if (!data.id || !data.name) throw new Error('Addon manifest is missing id or name.')
      if (!Array.isArray(data.resources) || !data.resources.length) throw new Error('Addon manifest does not declare any resources.')
      return { manifest: data, finalUrl }
    })

  manifestCache.set(normalized, { timestamp: Date.now(), value })
  return value
}

function resourceEntries(manifest) {
  return (manifest?.resources || []).map((resource) => typeof resource === 'string' ? { name: resource } : resource).filter(Boolean)
}

export function supportsResource(manifest, resourceName, type, id) {
  const matches = resourceEntries(manifest).filter((resource) => resource.name === resourceName)
  if (!matches.length) return false
  const typeSupported = matches.some((resource) => !Array.isArray(resource.types) || resource.types.includes(type))
  if (!typeSupported) return false
  const prefixRules = matches.flatMap((resource) => Array.isArray(resource.idPrefixes) ? resource.idPrefixes : [])
  if (!prefixRules.length) return true
  return prefixRules.some((prefix) => String(id).startsWith(prefix))
}

function endpointFromManifest(manifestUrl, resource, type, id) {
  const url = new URL(ensureManifestUrl(manifestUrl))
  const originalPath = url.pathname.replace(/\/manifest\.json$/i, '').replace(/\/$/, '')
  const encodedId = encodeURIComponent(String(id)).replace(/%3A/gi, ':')
  url.pathname = `${originalPath}/${resource}/${encodeURIComponent(type)}/${encodedId}.json`
  return url.toString()
}

export function buildResourceUrl(manifestUrl, resource, type, id) {
  return endpointFromManifest(manifestUrl, resource, type, id)
}

export async function getAddonStreams(addon, type, videoId) {
  if (!addon?.manifestUrl || !addon.enabled) return { addon, streams: [], error: 'Disabled or unconfigured' }
  let manifest
  let finalManifestUrl = addon.manifestUrl
  try {
    const fetched = await fetchManifest(addon.manifestUrl)
    manifest = fetched.manifest
    finalManifestUrl = fetched.finalUrl || addon.manifestUrl
    if (!supportsResource(manifest, 'stream', type, videoId)) {
      return { addon: { ...addon, manifest }, streams: [], error: 'Stream resource not supported for this title type.' }
    }
    const streamUrl = buildResourceUrl(finalManifestUrl, 'stream', type, videoId)
    const { data } = await fetchJSON(streamUrl)
    return {
      addon: { ...addon, manifest, manifestUrl: addon.manifestUrl },
      streams: Array.isArray(data?.streams) ? data.streams : [],
      error: '',
      requestUrl: streamUrl,
    }
  } catch (error) {
    return { addon: { ...addon, manifest }, streams: [], error: error?.name === 'AbortError' ? 'Request timed out.' : (error?.message || 'Unable to load addon.') }
  }
}

export function normalizeStream(stream, addon) {
  if (!stream || typeof stream !== 'object') return null
  const url = typeof stream.url === 'string' ? stream.url.trim() : ''
  const externalUrl = typeof stream.externalUrl === 'string' ? stream.externalUrl.trim() : ''
  const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === 'object' ? stream.behaviorHints : {}
  const title = stream.description || stream.title || stream.name || 'Stream'
  const lowered = `${title} ${url}`.toLowerCase()
  const isHls = /\.m3u8(?:$|[?#])/i.test(url) || lowered.includes('hls')
  const isHttp = /^https?:\/\//i.test(url)
  const pageIsHttps = typeof globalThis.location !== 'undefined' && globalThis.location.protocol === 'https:'
  const mixedContent = pageIsHttps && /^http:\/\//i.test(url)
  const looksUnsupportedFormat = /\.(mkv|avi|flv|wmv|ts)(?:$|[?#])/i.test(url)
  const safeForBrowser = isHttp && !mixedContent && !externalUrl && !behaviorHints.proxyHeaders && !looksUnsupportedFormat
  const browserReady = Boolean(
    safeForBrowser &&
    (!behaviorHints.notWebReady || isHls || /\.(mp4|webm|mov)(?:$|[?#])/i.test(url))
  )
  const qualityMatch = lowered.match(/(?:^|\D)(2160p|4k|1440p|1080p|fhd|720p|hd|576p|480p|360p|sd)(?:\D|$)/)
  const quality = qualityMatch?.[1] || ''
  const qualityRank = ({ '4k': 3, '2160p': 3, '1440p': 2.5, '1080p': 2, fhd: 2, '720p': 1.5, hd: 1.5, '576p': 1, '480p': 0.75, '360p': 0.5, sd: 0.4 })[quality] ?? 1
  const speedScore = isHls ? 0.85 : 1
  return {
    raw: stream,
    addonId: addon?.id || '',
    addonName: addon?.name || 'Addon',
    title,
    url,
    externalUrl,
    behaviorHints,
    isHls,
    browserReady,
    quality,
    score: (browserReady ? 100 : 0) + qualityRank * 10 + speedScore,
    subtitles: Array.isArray(stream.subtitles) ? stream.subtitles : [],
  }
}

export async function getAllStreams(addons, type, videoId, onBrowserReady) {
  const enabled = addons.filter(
    (addon) =>
      addon.enabled &&
      addon.kind !== 'subtitles' &&
      addon.kind !== 'next' &&
      addon.manifestUrl
  )

  const seen = new Set()
  const results = await Promise.all(
    enabled.map(async (addon) => {
      const result = await getAddonStreams(addon, type, videoId)
      const normalizedStreams = result.streams
        .map((stream) => normalizeStream(stream, result.addon))
        .filter(Boolean)

      const uniqueStreams = []
      for (const stream of normalizedStreams) {
        const key =
          stream.url ||
          stream.externalUrl ||
          stream.raw.infoHash ||
          `${stream.addonName}|${stream.title}`

        if (seen.has(key)) continue
        seen.add(key)
        uniqueStreams.push(stream)

        if (stream.browserReady && typeof onBrowserReady === 'function') {
          try {
            onBrowserReady(stream)
          } catch {
            // A UI callback must never break addon aggregation.
          }
        }
      }

      return {
        ...result,
        streams: uniqueStreams,
      }
    }),
  )

  const streams = results.flatMap((result) => result.streams)
  const browserReady = streams.filter((stream) => stream.browserReady)
  browserReady.sort((a, b) => b.score - a.score)

  return { results, streams, browserReady }
}

export async function getSubtitles(addons, type, videoId, streamCandidates = []) {
  const enabled = addons.filter((addon) => addon.enabled && addon.kind === 'subtitles' && addon.manifestUrl)
  const targetType = type === 'series' ? 'series' : 'movie'
  const direct = []

  const answers = await Promise.all(enabled.map(async (addon) => {
    try {
      const fetched = await fetchManifest(addon.manifestUrl)
      if (!supportsResource(fetched.manifest, 'subtitles', targetType, videoId)) return { addon, subtitles: [] }
      const subtitleUrl = buildResourceUrl(fetched.finalUrl || addon.manifestUrl, 'subtitles', targetType, videoId)
      const { data } = await fetchJSON(subtitleUrl)
      return { addon, subtitles: Array.isArray(data?.subtitles) ? data.subtitles : [] }
    } catch {
      return { addon, subtitles: [] }
    }
  }))

  direct.push(...answers.flatMap((answer) => answer.subtitles.map((subtitle) => ({
    ...subtitle,
    addonName: answer.addon.name,
  })).filter((subtitle) => subtitle.url)))

  for (const stream of streamCandidates) {
    if (Array.isArray(stream.subtitles)) direct.push(...stream.subtitles.map((subtitle) => ({ ...subtitle, addonName: stream.addonName })).filter((subtitle) => subtitle.url))
  }

  const seen = new Set()
  const unique = direct.filter((subtitle) => {
    const key = `${subtitle.lang || ''}|${subtitle.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const languageScore = (subtitle) => {
    const lang = String(subtitle.lang || '').toLowerCase()
    if (lang.startsWith('en') || lang === 'eng' || lang.includes('english')) return 0
    if (lang.startsWith('hi') || lang === 'hin' || lang.includes('hindi')) return 1
    return 2
  }

  return unique.sort((a, b) => languageScore(a) - languageScore(b))
}

export function getPrimaryPlayableSource(streams) {
  return streams.find((stream) => stream.browserReady) || null
}
