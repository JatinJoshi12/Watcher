import { buildStreamUrl, fetchAddonManifest, getStreamAddons } from './streamAddons'

function titleFromStream(stream) {
  const raw = String(stream?.title || stream?.name || '').split('\n')[0].trim()
  return raw || ''
}

export async function fetchWatchNext({ type, videoId }) {
  const addon = getStreamAddons().find((entry) => entry.id === 'watch-next' && entry.enabled && entry.manifestUrl)
  if (!addon) return []

  const manifest = await fetchAddonManifest(addon.manifestUrl, 8000)
  const url = buildStreamUrl(addon.manifestUrl, type, videoId)
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) return []
  const data = await response.json()
  const streams = Array.isArray(data?.streams) ? data.streams : []

  return streams
    .map((stream, index) => ({
      id: `${index}-${stream?.externalUrl || stream?.ytId || stream?.title || ''}`,
      title: titleFromStream(stream),
      url: stream?.externalUrl || (stream?.ytId ? `https://www.youtube.com/watch?v=${stream.ytId}` : ''),
      addonName: manifest.name || addon.name,
    }))
    .filter((entry) => entry.title && entry.url)
    .slice(0, 8)
}
