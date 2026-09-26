export function titleCaseText(value = '') {
  const connectors = new Set(['and', 'or', 'of', 'the', 'in', 'on', 'for', 'to', 'with', 'from', 'a', 'an', 'as', 'at', 'by', 'but', 'nor', 'via'])
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const leading = word.match(/^[^A-Za-z0-9]*/)?.[0] || ''
      const trailing = word.match(/[^A-Za-z0-9.!?,:;')\]]+$/)?.[0] || ''
      const core = word.slice(leading.length, word.length - trailing.length || undefined)
      const lower = core.toLowerCase()
      if (index > 0 && connectors.has(lower)) return `${leading}${lower}${trailing}`
      const formatted = lower.split(/([-':])/).map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join('')
      return `${leading}${formatted}${trailing}`
    })
    .join(' ')
}

export function labelType(type) {
  return type === 'series' ? 'Web Series' : 'Movie'
}

export function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatGenre(genre) {
  return Array.isArray(genre) ? genre.filter(Boolean).join(' · ') : ''
}

export function calculateStats(items) {
  const rated = items.filter((item) => Number.isFinite(Number(item.rating)))
  const ratingSum = rated.reduce((sum, item) => sum + Number(item.rating), 0)
  return {
    total: items.length,
    movies: items.filter((item) => item.type === 'movie').length,
    series: items.filter((item) => item.type === 'series').length,
    watched: items.filter((item) => item.status === 'watched').length,
    unwatched: items.filter((item) => item.status !== 'watched').length,
    favorites: items.filter((item) => item.favorite).length,
    averageRating: rated.length ? Number((ratingSum / rated.length).toFixed(1)) : null,
  }
}

export function filterItems(items, filters) {
  const query = filters.search.trim().toLowerCase()
  return items.filter((item) => {
    if (query) {
      const haystack = [
        item.title,
        item.type,
        item.year,
        ...(Array.isArray(item.genre) ? item.genre : []),
        item.platform,
        item.language,
        item.description,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (filters.type && item.type !== filters.type) return false
    if (filters.status && item.status !== filters.status) return false
    if (filters.genre && !(Array.isArray(item.genre) && item.genre.includes(filters.genre))) return false
    if (filters.platform && item.platform !== filters.platform) return false
    if (filters.language && item.language !== filters.language) return false
    if (filters.favorite && !item.favorite) return false
    if (filters.year && String(item.year ?? '') !== String(filters.year)) return false
    return true
  })
}

export function sortItems(items, option) {
  return [...items].sort((a, b) => {
    const fallback = String(a.title || '').localeCompare(String(b.title || ''))
    switch (option) {
      case 'updated_desc': return compareDate(b.updated_at, a.updated_at) || fallback
      case 'title_asc': return String(a.title || '').localeCompare(String(b.title || '')) || compareDate(a.created_at, b.created_at)
      case 'title_desc': return String(b.title || '').localeCompare(String(a.title || '')) || compareDate(a.created_at, b.created_at)
      case 'year_desc': return (Number(b.year) || -Infinity) - (Number(a.year) || -Infinity) || fallback
      case 'year_asc': return (Number(a.year) || Infinity) - (Number(b.year) || Infinity) || fallback
      case 'rating_desc': return (Number(b.rating) || -Infinity) - (Number(a.rating) || -Infinity) || fallback
      case 'rating_asc': return (Number(a.rating) || Infinity) - (Number(b.rating) || Infinity) || fallback
      case 'created_desc':
      default: return compareDate(b.created_at, a.created_at) || fallback
    }
  })
}

function compareDate(a, b) {
  return (a ? new Date(a).getTime() : 0) - (b ? new Date(b).getTime() : 0)
}

export function getWatchedAtPatch(item, nextStatus) {
  if (item.status === 'watched' && nextStatus === 'unwatched') return { watched_at: null }
  if (item.status !== 'watched' && nextStatus === 'watched') return { watched_at: new Date().toISOString() }
  return {}
}

export function getWatchNext(items) {
  const unwatched = items.filter((item) => item.status !== 'watched')
  return [...unwatched].sort((a, b) => {
    const favoriteDelta = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))
    if (favoriteDelta) return favoriteDelta
    const ratingDelta = (Number(b.rating) || 0) - (Number(a.rating) || 0)
    if (ratingDelta) return ratingDelta
    return compareDate(b.created_at, a.created_at)
  }).slice(0, 6)
}
