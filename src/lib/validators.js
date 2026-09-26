export const TYPE_OPTIONS = [
  { value: 'movie', label: 'Movie' },
  { value: 'series', label: 'Web Series' },
]

export const STATUS_OPTIONS = [
  { value: 'unwatched', label: 'Unwatched' },
  { value: 'watched', label: 'Watched' },
]

export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western', 'Custom'
]

export const PLATFORMS = [
  'Netflix', 'Prime Video', 'Disney+', 'HBO', 'Apple TV+', 'YouTube', 'JioHotstar', 'SonyLIV', 'Other'
]

export const LANGUAGES = ['English', 'Hindi', 'Korean', 'Japanese', 'Spanish', 'Other']

export function validateItem(input) {
  const errors = {}
  const title = String(input.title ?? '').trim()
  if (!title) errors.title = 'Title is required.'

  if (!['movie', 'series'].includes(input.type)) errors.type = 'Choose Movie or Web Series.'

  if (input.year !== '' && input.year !== null && input.year !== undefined) {
    const year = Number(input.year)
    const currentYear = new Date().getFullYear() + 2
    if (!Number.isInteger(year) || year < 1888 || year > currentYear) {
      errors.year = `Enter a year between 1888 and ${currentYear}.`
    }
  }

  if (input.rating !== '' && input.rating !== null && input.rating !== undefined) {
    const rating = Number(input.rating)
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) errors.rating = 'Rating must be between 1 and 5.'
  }

  if (input.poster_url) {
    try {
      const url = new URL(String(input.poster_url))
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
    } catch {
      errors.poster_url = 'Enter a valid http(s) image URL.'
    }
  }

  if (input.status && !['watched', 'unwatched'].includes(input.status)) {
    errors.status = 'Invalid status.'
  }

  if (input.type === 'movie' && (input.progress || input.current_season || input.current_episode)) {
    errors.progress = 'Episode progress belongs to web series only.'
  }

  return { valid: Object.keys(errors).length === 0, errors, normalizedTitle: title }
}

export function normalizeItem(input) {
  const genres = Array.isArray(input.genre)
    ? input.genre.map((item) => String(item).trim()).filter(Boolean)
    : String(input.genre || '').split(',').map((item) => item.trim()).filter(Boolean)

  return {
    title: String(input.title ?? '').trim(),
    type: input.type === 'series' ? 'series' : 'movie',
    year: input.year === '' || input.year == null ? null : Number(input.year),
    genre: genres,
    poster_url: String(input.poster_url ?? '').trim() || null,
    description: String(input.description ?? '').trim() || null,
    notes: String(input.notes ?? '').trim() || null,
    status: input.status === 'watched' ? 'watched' : 'unwatched',
    rating: input.rating === '' || input.rating == null ? null : Number(input.rating),
    platform: String(input.platform ?? '').trim() || null,
    language: String(input.language ?? '').trim() || null,
    favorite: Boolean(input.favorite),
    progress: input.type === 'series' ? clamp(Number(input.progress) || 0, 0, 100) : null,
    current_season: input.type === 'series' ? nullablePositiveInt(input.current_season) : null,
    current_episode: input.type === 'series' ? nullablePositiveInt(input.current_episode) : null,
    total_seasons: input.type === 'series' ? nullablePositiveInt(input.total_seasons) : null,
    total_episodes: input.type === 'series' ? nullablePositiveInt(input.total_episodes) : null,
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function nullablePositiveInt(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}
