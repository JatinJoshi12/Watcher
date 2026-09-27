import { buildSubtitlesUrl, fetchAddonManifest, getStreamAddons } from './streamAddons'

export async function fetchSubtitles({ addon, type, videoId }) {
  const manifest = await fetchAddonManifest(addon.manifestUrl, 9000)
  const resources = Array.isArray(manifest.resources) ? manifest.resources : []
  const supports = resources.some((resource) => {
    if (typeof resource === 'string') return resource === 'subtitles'
    const types = Array.isArray(resource?.types) ? resource.types : manifest.types
    return resource?.name === 'subtitles' && (!types?.length || types.includes(type))
  })
  if (!supports) throw new Error('Addon Does Not Advertise Subtitles For This Type.')

  const url = buildSubtitlesUrl(addon.manifestUrl, type, videoId)
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Subtitle Request Failed (${response.status})`)
  const data = await response.json()
  return Array.isArray(data?.subtitles) ? data.subtitles : []
}

export async function findSubtitles({ type, videoId }) {
  const addon = getStreamAddons().find((entry) => entry.id === 'opensubtitles-pro' && entry.enabled && entry.manifestUrl)
  if (!addon) return { tracks: [], error: 'OpenSubtitles Is Not Configured.' }

  try {
    const subtitles = await fetchSubtitles({ addon, type, videoId })
    const tracks = subtitles
      .map((subtitle, index) => ({
        id: subtitle.id || `${addon.id}-${index}`,
        url: subtitle.url || subtitle.file || '',
        lang: subtitle.lang || subtitle.language || 'en',
        label: subtitle.label || subtitle.lang || subtitle.language || 'English',
        format: String(subtitle.format || '').toLowerCase(),
      }))
      .filter((track) => track.url)
    return { tracks, error: '' }
  } catch (error) {
    return { tracks: [], error: error.message || 'Unable To Load Subtitles.' }
  }
}

export function normalizeSubtitleUrl(track) {
  return String(track?.url || '')
}
