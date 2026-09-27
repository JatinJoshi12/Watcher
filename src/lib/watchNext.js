const WATCH_NEXT_MANIFEST = 'https://099757617587-watch-next.baby-beamup.club/manifest.json'

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Watch Next Request Failed (${response.status}).`)
    return response.json()
  } finally {
    window.clearTimeout(timer)
  }
}

export async function fetchWatchNext({ type, videoId }) {
  if (!videoId) return []
  try {
    const manifest = await fetchJson(WATCH_NEXT_MANIFEST)
    const catalogs = Array.isArray(manifest?.catalogs) ? manifest.catalogs : []
    const catalog = catalogs.find((entry) => entry.type === type) || catalogs[0]
    if (!catalog?.id) return []
    const base = WATCH_NEXT_MANIFEST.replace(/\/manifest\.json(?:[?#].*)?$/i, '')
    const data = await fetchJson(`${base}/catalog/${catalog.type}/${catalog.id}.json`)
    return (Array.isArray(data?.metas) ? data.metas : []).slice(0, 12).map((entry) => ({
      id: entry.id,
      title: entry.name || entry.title || 'Recommended Title',
      poster: entry.poster || '',
      url: '',
    }))
  } catch {
    return []
  }
}

export { WATCH_NEXT_MANIFEST }
