import { describe, expect, it } from 'vitest'
import { normalizeItem, validateItem } from './validators'

const valid = { title: 'Interstellar', type: 'movie', year: '2014', rating: '4.8', status: 'unwatched' }

describe('validateItem', () => {
  it('requires a title and valid type', () => {
    expect(validateItem({ ...valid, title: '' }).valid).toBe(false)
    expect(validateItem({ ...valid, type: 'book' }).valid).toBe(false)
  })

  it('accepts valid year, rating, and URL', () => {
    expect(validateItem({ ...valid, poster_url: 'https://example.com/poster.jpg' }).valid).toBe(true)
  })

  it('rejects invalid rating and URL', () => {
    const result = validateItem({ ...valid, rating: 8, poster_url: 'not-a-url' })
    expect(result.errors.rating).toBeTruthy()
    expect(result.errors.poster_url).toBeTruthy()
  })
})

describe('normalizeItem', () => {
  it('normalizes optional fields and genres', () => {
    const result = normalizeItem({ ...valid, title: '  Interstellar  ', genre: ['Sci-Fi', ' Drama '], favorite: 1 })
    expect(result.title).toBe('Interstellar')
    expect(result.genre).toEqual(['Sci-Fi', 'Drama'])
    expect(result.rating).toBe(4.8)
    expect(result.favorite).toBe(true)
  })
})
