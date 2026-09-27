import { getManifestResourceUrl, getStreamAddons } from './streamAddons'

const SUBTITLE_MANIFEST = 'https://opensubtitlesv3-pro.dexter21767.com/eyJsYW5ncyI6WyJlbmdsaXNoIl0sInNvdXJjZSI6ImFsbCIsImFpVHJhbnNsYXRlZCI6dHJ1ZSwiYXV0b0FkanVzdG1lbnQiOmZhbHNlfQ==/manifest.json'

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Subtitle Request Failed (${response.status}).`)
    return response.json()
  } finally {
    window.clearTimeout(timer)
  }
}

export async function findSubtitles({ type, videoId }) {
  if (!videoId) return { tracks: [], error: null }
  try {
    const url = getManifestResourceUrl(SUBTITLE_MANIFEST, 'subtitles', type, videoId)
    const data = await fetchJson(url)
    const tracks = (Array.isArray(data?.subtitles) ? data.subtitles : [])
      .filter((entry) => entry?.url)
      .map((entry, index) => ({
        id: entry.id || `${index}-${entry.url}`,
        url: entry.url,
        lang: entry.lang || entry.language || 'en',
        label: entry.label || entry.lang || entry.language || 'English',
        format: String(entry.format || '').toLowerCase(),
      }))
    return { tracks, error: null }
  } catch (error) {
    return { tracks: [], error: error?.message || 'Subtitles Unavailable.' }
  }
}

export { SUBTITLE_MANIFEST }
