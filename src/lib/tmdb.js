const API_BASE = 'https://api.themoviedb.org/3'
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280'
const token = import.meta.env?.VITE_TMDB_API_TOKEN?.trim() || ''

export const tmdbConfigured = Boolean(token)

function withQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  return `${API_BASE}${path}?${query.toString()}`
}

async function request(path, params = {}) {
  if (!token) throw new Error('TMDB Is Not Configured. Add VITE_TMDB_API_TOKEN To Your .env File.')
  const response = await fetch(withQuery(path, params), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!response.ok) {
    if (response.status === 429) throw new Error('TMDB Is Temporarily Rate-Limiting Requests. Try Again In A Moment.')
    throw new Error(`TMDB Request Failed (${response.status}).`)
  }
  return response.json()
}

function normalizeResult(item, forcedType = null) {
  const type = forcedType || item.media_type
  const isSeries = type === 'series'
  const title = isSeries ? item.name : item.title
  const date = isSeries ? item.first_air_date : item.release_date

  return {
    tmdb_id: item.id,
    type,
    title: title || 'Untitled',
    year: date ? Number(String(date).slice(0, 4)) : null,
    release_date: date || null,
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    poster_url: posterUrl(item.poster_path),
    backdrop_url: backdropUrl(item.backdrop_path),
    overview: item.overview || '',
    tmdb_rating: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : null,
    vote_count: Number.isFinite(Number(item.vote_count)) ? Number(item.vote_count) : 0,
    popularity: Number.isFinite(Number(item.popularity)) ? Number(item.popularity) : 0,
    original_language: item.original_language || null,
  }
}

export function posterUrl(path) {
  return path ? `${POSTER_BASE}${path}` : ''
}

export function backdropUrl(path) {
  return path ? `${BACKDROP_BASE}${path}` : ''
}

export async function searchCatalog(query, { type = 'all', page = 1 } = {}) {
  const clean = query.trim()
  if (!clean) return { results: [], page: 1, total_pages: 0, total_results: 0 }

  if (type === 'movie') {
    const data = await request('/search/movie', { query: clean, page, include_adult: false })
    return { ...data, results: (data.results || []).map((item) => normalizeResult(item, 'movie')) }
  }

  if (type === 'series') {
    const data = await request('/search/tv', { query: clean, page, include_adult: false })
    return { ...data, results: (data.results || []).map((item) => normalizeResult(item, 'series')) }
  }

  const data = await request('/search/multi', { query: clean, page, include_adult: false })
  return {
    ...data,
    results: (data.results || [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item) => normalizeResult(item, item.media_type === 'tv' ? 'series' : 'movie')),
  }
}

export async function searchPeople(query, { page = 1 } = {}) {
  const clean = query.trim()
  if (!clean) return { results: [], page: 1, total_pages: 0, total_results: 0 }
  const data = await request('/search/person', { query: clean, page, include_adult: false })
  return {
    ...data,
    results: (data.results || []).map((person) => ({
      id: person.id,
      name: person.name || 'Unknown Person',
      profile_path: person.profile_path || null,
      profile_url: person.profile_path ? posterUrl(person.profile_path) : '',
      popularity: Number(person.popularity) || 0,
    })),
  }
}

export async function discoverCatalog({ type = 'movie', genreId = '', page = 1 } = {}) {
  const endpoint = type === 'series' ? '/discover/tv' : '/discover/movie'
  const params = {
    page,
    sort_by: 'popularity.desc',
    include_adult: false,
    include_video: false,
  }
  if (genreId) params.with_genres = genreId

  const data = await request(endpoint, params)
  return {
    ...data,
    results: (data.results || []).map((item) => normalizeResult(item, type)),
  }
}

export async function getGenres() {
  const [movies, series] = await Promise.all([
    request('/genre/movie/list'),
    request('/genre/tv/list'),
  ])

  const movieGenres = movies.genres || []
  const seriesGenres = series.genres || []

  return {
    movies: movieGenres,
    series: seriesGenres,
    names: [...new Set([...movieGenres, ...seriesGenres].map((item) => item.name))].sort(),
    movieByName: new Map(movieGenres.map((item) => [item.name, item.id])),
    seriesByName: new Map(seriesGenres.map((item) => [item.name, item.id])),
  }
}

function today() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function addMonths(date, months) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function unique(items) {
  return [...new Map(items.map((item) => [`${item.type}-${item.tmdb_id}`, item])).values()]
}

async function upcomingPage(type, from, to, page = 1, language = '') {
  const params = {
    page,
    sort_by: 'popularity.desc',
    include_adult: false,
    include_video: false,
  }

  if (language) params.with_original_language = language

  if (type === 'movie') {
    params['primary_release_date.gte'] = from
    params['primary_release_date.lte'] = to
  } else {
    params['first_air_date.gte'] = from
    params['first_air_date.lte'] = to
  }

  const data = await request(type === 'movie' ? '/discover/movie' : '/discover/tv', params)
  return (data.results || []).map((item) => normalizeResult(item, type))
}

async function multiPage(type, from, to) {
  const [all, english, hindi] = await Promise.all([
    Promise.all([1, 2].map((page) => upcomingPage(type, from, to, page))),
    upcomingPage(type, from, to, 1, 'en'),
    upcomingPage(type, from, to, 1, 'hi'),
  ])

  return unique([
    ...all.flat(),
    ...english,
    ...hindi,
  ]).sort((a, b) => String(a.release_date || '').localeCompare(String(b.release_date || '')))
}

async function trendingType(type) {
  const data = await request(`/trending/${type === 'series' ? 'tv' : 'movie'}/week`)
  return (data.results || []).map((item) => normalizeResult(item, type))
}

export async function getHomeCatalog() {
  const start = today()
  const end = addMonths(start, 3)
  const from = dateKey(start)
  const to = dateKey(end)

  const [upcomingMovies, upcomingSeries, topMovies, topSeries] = await Promise.all([
    multiPage('movie', from, to),
    multiPage('series', from, to),
    trendingType('movie'),
    trendingType('series'),
  ])

  return {
    upcomingMovies: upcomingMovies.slice(0, 20),
    upcomingSeries: upcomingSeries.slice(0, 20),
    topMovies: topMovies.slice(0, 20),
    topSeries: topSeries.slice(0, 20),
  }
}

function chooseVideo(videos) {
  return (videos || [])
    .filter((video) => video.site === 'YouTube' && ['Trailer', 'Teaser'].includes(video.type) && video.key)
    .sort((a, b) => {
      const official = Number(Boolean(b.official)) - Number(Boolean(a.official))
      if (official) return official
      return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
    })[0] || null
}

async function videosFor(item) {
  const path = item.type === 'movie' ? `/movie/${item.tmdb_id}/videos` : `/tv/${item.tmdb_id}/videos`
  const data = await request(path)
  const video = chooseVideo(data.results)
  if (!video) return null
  return {
    ...item,
    video_key: video.key,
    video_name: video.name,
    video_type: video.type,
    video_published_at: video.published_at,
    video_url: `https://www.youtube.com/watch?v=${video.key}`,
  }
}

async function recentTitles(type) {
  const end = today()
  const start = addDays(end, -180)
  const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv'
  const pages = [1, 2]

  const results = await Promise.all(pages.map(async (page) => {
    const params = {
      page,
      sort_by: 'primary_release_date.desc',
      include_adult: false,
      include_video: false,
    }

    if (type === 'movie') {
      params['primary_release_date.gte'] = dateKey(start)
      params['primary_release_date.lte'] = dateKey(end)
    } else {
      params['first_air_date.gte'] = dateKey(start)
      params['first_air_date.lte'] = dateKey(end)
    }

    const data = await request(endpoint, params)
    return (data.results || []).map((item) => normalizeResult(item, type))
  }))

  return unique(results.flat()).slice(0, 40)
}

async function resolveInBatches(items, size = 8) {
  const resolved = []

  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size)
    const values = await Promise.all(batch.map(async (item) => {
      try {
        return await videosFor(item)
      } catch {
        return null
      }
    }))
    resolved.push(...values)
  }

  return resolved
}

export async function getRecentTrailers() {
  const [movies, series] = await Promise.all([recentTitles('movie'), recentTitles('series')])
  const candidates = unique([...movies, ...series])
    .sort((a, b) => {
      const dateDiff = new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime()
      return dateDiff || (b.popularity - a.popularity)
    })
    .slice(0, 48)

  const resolved = await resolveInBatches(candidates, 8)

  return resolved
    .filter(Boolean)
    .sort((a, b) => new Date(b.video_published_at || 0).getTime() - new Date(a.video_published_at || 0).getTime())
    .slice(0, 30)
}

export async function getTitleDetails(id, type = 'movie') {
  const endpoint = type === 'series' ? `/tv/${id}` : `/movie/${id}`
  const data = await request(endpoint)
  const normalized = normalizeResult(data, type)
  const runtimes = type === 'series' ? (Array.isArray(data.episode_run_time) ? data.episode_run_time : []) : []
  const averageEpisodeRuntime = runtimes.length
    ? Math.round(runtimes.reduce((sum, value) => sum + Number(value || 0), 0) / runtimes.length)
    : null
  return {
    ...normalized,
    runtime_minutes: type === 'movie' ? (Number(data.runtime) || null) : null,
    episode_runtime_minutes: averageEpisodeRuntime,
    total_episodes: type === 'series' ? (Number(data.number_of_episodes) || null) : null,
    total_seasons: type === 'series' ? (Number(data.number_of_seasons) || null) : null,
    genre_ids: Array.isArray(data.genres) ? data.genres.map((genre) => genre.id).filter(Boolean) : normalized.genre_ids,
    genre_names: Array.isArray(data.genres) ? data.genres.map((genre) => genre.name).filter(Boolean) : [],
    tagline: data.tagline || '',
  }
}


export async function getExternalIds(id, type = 'movie') {
  const endpoint = type === 'series' ? `/tv/${id}/external_ids` : `/movie/${id}/external_ids`
  const data = await request(endpoint)
  return {
    imdb_id: data.imdb_id || null,
    tmdb_id: id != null ? Number(id) : null,
    tvdb_id: data.tvdb_id || null,
  }
}

export async function getSeasonDetails(id, seasonNumber) {
  if (seasonNumber == null || Number.isNaN(Number(seasonNumber))) {
    throw new Error('A Season Number Is Required.')
  }
  const data = await request(`/tv/${id}/season/${Number(seasonNumber)}`)
  return {
    season_number: Number(data.season_number) || Number(seasonNumber),
    episodes: Array.isArray(data.episodes) ? data.episodes.map((episode) => ({
      episode_number: Number(episode.episode_number),
      name: episode.name || `Episode ${episode.episode_number}`,
      air_date: episode.air_date || null,
    })) : [],
  }
}

export async function getSimilar(id, type = 'movie', page = 1) {
  const endpoint = type === 'series' ? `/tv/${id}/similar` : `/movie/${id}/similar`
  const data = await request(endpoint, { page })
  return (data.results || []).map((item) => normalizeResult(item, type))
}

export async function discoverRandomCandidates({ type = 'movie', genreId = '', runtimeMin = '', runtimeMax = '', page = 1 } = {}) {
  const endpoint = type === 'series' ? '/discover/tv' : '/discover/movie'
  const params = {
    page,
    sort_by: 'popularity.desc',
    include_adult: false,
    include_video: false,
  }
  if (genreId) params.with_genres = genreId
  if (runtimeMin !== '' && runtimeMin != null) params['with_runtime.gte'] = runtimeMin
  if (runtimeMax !== '' && runtimeMax != null) params['with_runtime.lte'] = runtimeMax
  const data = await request(endpoint, params)
  return {
    ...data,
    results: (data.results || []).map((item) => normalizeResult(item, type)),
  }
}
