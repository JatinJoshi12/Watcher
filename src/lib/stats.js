export function dedupeTitles(items = []) {
  const sorted = [...items].sort((a, b) => {
    const da = new Date(a.watched_at || a.updated_at || a.created_at || 0).getTime()
    const db = new Date(b.watched_at || b.updated_at || b.created_at || 0).getTime()
    return db - da
  })
  return [...new Map(sorted.map((item) => [`${item.type}-${item.tmdb_id ?? item.id}`, item])).values()]
}

export function watchedTitles(items = []) {
  return dedupeTitles(items.filter((item) => item.status === 'watched'))
}

export function genreFrequency(items = [], type = null) {
  const counts = new Map()
  items
    .filter((item) => !type || item.type === type)
    .forEach((item) => {
      ;(Array.isArray(item.genre) ? item.genre : []).forEach((genre) => {
        if (!genre) return
        counts.set(genre, (counts.get(genre) || 0) + 1)
      })
    })
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function mostCommonGenre(items, type) {
  return genreFrequency(items, type)[0]?.[0] || 'Not Enough Data'
}

export function averageRating(items = []) {
  const values = items.map((item) => Number(item.rating)).filter((value) => Number.isFinite(value) && value > 0)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function totalMovieMinutes(items = []) {
  return watchedTitles(items)
    .filter((item) => item.type === 'movie')
    .reduce((sum, item) => sum + (Number(item.runtime_minutes) || 0), 0)
}

export function totalSeriesMinutes(items = []) {
  return watchedTitles(items)
    .filter((item) => item.type === 'series')
    .reduce((sum, item) => {
      const episodeMinutes = Number(item.episode_runtime_minutes) || 0
      const episodes = Number(item.total_episodes) || 0
      return sum + episodeMinutes * episodes
    }, 0)
}

export function formatDuration(totalMinutes = 0, estimated = false) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0))
  if (!minutes) return 'Not Available'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  const value = hours >= 24
    ? `${Math.floor(hours / 24)}d ${hours % 24}h`
    : `${hours}h ${remainder}m`
  return estimated ? `~${value}` : value
}

export function formatHours(totalMinutes = 0, estimated = false) {
  const hours = (Number(totalMinutes) || 0) / 60
  if (!hours) return '0h'
  return `${estimated ? '~' : ''}${hours.toFixed(hours >= 100 ? 0 : 1)}h`
}

export function highestRated(items = [], type = null) {
  return items
    .filter((item) => !type || item.type === type)
    .filter((item) => Number.isFinite(Number(item.rating)))
    .sort((a, b) => Number(b.rating) - Number(a.rating))[0] || null
}

export function yearActivity(items = [], year) {
  const watched = watchedTitles(items).filter((item) => {
    const stamp = item.watched_at || item.updated_at || item.created_at
    if (!stamp) return false
    return new Date(stamp).getFullYear() === year
  })
  const added = dedupeTitles(items).filter((item) => {
    if (!item.created_at) return false
    return new Date(item.created_at).getFullYear() === year
  })
  return { watched, added }
}

export function mostActiveMonth(items = []) {
  const counts = new Map()
  items.forEach((item) => {
    const stamp = item.watched_at || item.updated_at || item.created_at
    if (!stamp) return
    const month = new Date(stamp).toLocaleString(undefined, { month: 'long' })
    counts.set(month, (counts.get(month) || 0) + 1)
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Not Enough Data'
}
