import { describe, expect, it } from 'vitest'
import { calculateStats, filterItems, sortItems } from './utils'

const items = [
  { id: '1', title: 'Zeta', type: 'movie', year: 2024, genre: ['Action'], status: 'watched', favorite: true, rating: 4.5, created_at: '2026-09-01T00:00:00Z' },
  { id: '2', title: 'Alpha', type: 'series', year: 2026, genre: ['Drama'], status: 'unwatched', favorite: false, rating: null, created_at: '2026-09-03T00:00:00Z' },
]

describe('watchlist utilities', () => {
  it('calculates stats from actual items', () => {
    expect(calculateStats(items)).toMatchObject({ total: 2, movies: 1, series: 1, watched: 1, unwatched: 1, favorites: 1, averageRating: 4.5 })
  })

  it('combines search and filters', () => {
    const result = filterItems(items, { search: 'alpha', type: 'series', status: 'unwatched', genre: '', year: '', platform: '', language: '', favorite: false })
    expect(result.map((item) => item.id)).toEqual(['2'])
  })

  it('sorts without mutating the original array', () => {
    const result = sortItems(items, 'title_asc')
    expect(result.map((item) => item.title)).toEqual(['Alpha', 'Zeta'])
    expect(items.map((item) => item.title)).toEqual(['Zeta', 'Alpha'])
  })
})
