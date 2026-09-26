import { useMemo, useState } from 'react'
import { GENRES, LANGUAGES, PLATFORMS, TYPE_OPTIONS } from '../lib/validators'
import { validateItem, normalizeItem } from '../lib/validators'
import { Icon } from './Icon'

const empty = {
  title: '', type: 'movie', year: '', genre: [], poster_url: '', description: '', notes: '', rating: '',
  platform: '', language: '', status: 'unwatched', favorite: false, progress: 0,
  current_season: '', current_episode: '', total_seasons: '', total_episodes: '',
}

export function emptyForm() {
  return { ...empty, genre: [] }
}

export default function WatchlistForm({ initialData, onSubmit, onCancel, submitting = false }) {
  const isEditing = Boolean(initialData)

  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    ...(initialData || {}),
    genre: Array.isArray(initialData?.genre) ? initialData.genre : [],
  }))

  const [errors, setErrors] = useState({})
  const [genreInput, setGenreInput] = useState('')

  const isSeries = form.type === 'series'
  const modeLabel = isEditing ? 'Save Changes' : 'Add Title'
  const selectedGenres = useMemo(() => form.genre || [], [form.genre])

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const addGenre = () => {
    const next = genreInput.trim()
    if (!next || selectedGenres.includes(next)) {
      setGenreInput('')
      return
    }
    set('genre', [...selectedGenres, next])
    setGenreInput('')
  }

  const removeGenre = (genre) => {
    set('genre', selectedGenres.filter((item) => item !== genre))
  }

  const submit = async (event) => {
    event.preventDefault()

    if (isEditing) {
      const next = {
        ...initialData,
        title: form.title,
        description: form.description,
      }

      const result = validateItem(next)
      if (!result.valid) {
        setErrors(result.errors)
        return
      }

      setErrors({})
      await onSubmit(normalizeItem(next))
      return
    }

    const result = validateItem(form)
    if (!result.valid) {
      setErrors(result.errors)
      return
    }

    setErrors({})
    await onSubmit(normalizeItem(form))
  }

  return (
    <form className={`watchlist-form ${isEditing ? 'watchlist-edit-form' : ''}`} onSubmit={submit}>
      {isEditing ? (
        <div className="watcher-edit-form-panel">
          <div className="watcher-edit-form-heading">
            <span className="watcher-kicker">EDIT TITLE</span>
            <h3>{form.title || 'Edit Title'}</h3>
            <p>Only The Title And Story Description Can Be Changed Here.</p>
          </div>

          <div className="watcher-edit-form-fields">
            <div className="watcher-modal-field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                value={form.title}
                onChange={(event) => set('title', event.target.value)}
                autoFocus
                maxLength={200}
                required
              />
              {errors.title ? <div className="field-error">{errors.title}</div> : null}
            </div>

            <div className="watcher-modal-field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={form.description ?? ''}
                onChange={(event) => set('description', event.target.value)}
                rows={8}
                maxLength={2000}
                placeholder="Tell The Story You Want To Remember..."
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="form-grid form-grid-main">
            <div className="field field-span-2">
              <label htmlFor="title">Title <span className="required">Required</span></label>
              <input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Interstellar" autoFocus />
              {errors.title ? <div className="field-error">{errors.title}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="type">Type <span className="required">Required</span></label>
              <select id="type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {errors.type ? <div className="field-error">{errors.type}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="year">Year</label>
              <input id="year" inputMode="numeric" value={form.year ?? ''} onChange={(e) => set('year', e.target.value)} placeholder="2026" />
              {errors.year ? <div className="field-error">{errors.year}</div> : null}
            </div>
            <div className="field field-span-2">
              <label htmlFor="genreInput">Genres</label>
              <div className="inline-input">
                <input id="genreInput" value={genreInput} onChange={(e) => setGenreInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGenre() } }} placeholder="Type A Genre And Press Enter" />
                <button type="button" className="button button-secondary" onClick={addGenre}><Icon name="plus" size={16} />Add</button>
              </div>
              {selectedGenres.length ? <div className="genre-editor">{selectedGenres.map((genre) => <button type="button" className="filter-chip" key={genre} onClick={() => removeGenre(genre)}>{genre} ×</button>)}</div> : null}
            </div>
            <div className="field field-span-2">
              <label htmlFor="poster_url">Poster URL</label>
              <input id="poster_url" type="url" value={form.poster_url} onChange={(e) => set('poster_url', e.target.value)} placeholder="https://..." />
              {errors.poster_url ? <div className="field-error">{errors.poster_url}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="platform">Platform</label>
              <select id="platform" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
                <option value="">Not Specified</option>
                {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="language">Language</label>
              <select id="language" value={form.language} onChange={(e) => set('language', e.target.value)}>
                <option value="">Not Specified</option>
                {LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rating">Personal Rating</label>
              <input id="rating" inputMode="decimal" type="number" min="1" max="5" step="0.1" value={form.rating ?? ''} onChange={(e) => set('rating', e.target.value)} placeholder="1–5" />
              {errors.rating ? <div className="field-error">{errors.rating}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="unwatched">Unwatched</option>
                <option value="watched">Watched</option>
              </select>
            </div>
            <div className="field field-span-2">
              <label htmlFor="description">Description</label>
              <textarea id="description" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows="4" maxLength="2000" placeholder="A Short Description Or Context For This Title." />
            </div>
            <div className="field field-span-2">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} rows="4" maxLength="4000" placeholder="Personal Notes. These Stay Private To Your Account." />
            </div>
            <label className="checkbox-field field-span-2">
              <input type="checkbox" checked={form.favorite} onChange={(e) => set('favorite', e.target.checked)} />
              <span>Favorite This Title</span>
            </label>
          </div>

          {isSeries ? (
            <div className="form-section">
              <div className="form-section-heading">
                <div>
                  <h3>Series Progress</h3>
                  <p>Episode Tracking Is Only Shown For Web Series.</p>
                </div>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="current_season">Current Season</label><input id="current_season" inputMode="numeric" type="number" min="0" value={form.current_season ?? ''} onChange={(e) => set('current_season', e.target.value)} /></div>
                <div className="field"><label htmlFor="current_episode">Current Episode</label><input id="current_episode" inputMode="numeric" type="number" min="0" value={form.current_episode ?? ''} onChange={(e) => set('current_episode', e.target.value)} /></div>
                <div className="field"><label htmlFor="total_seasons">Total Seasons</label><input id="total_seasons" inputMode="numeric" type="number" min="0" value={form.total_seasons ?? ''} onChange={(e) => set('total_seasons', e.target.value)} /></div>
                <div className="field"><label htmlFor="total_episodes">Total Episodes</label><input id="total_episodes" inputMode="numeric" type="number" min="0" value={form.total_episodes ?? ''} onChange={(e) => set('total_episodes', e.target.value)} /></div>
                <div className="field field-span-2">
                  <label htmlFor="progress">Progress (%)</label>
                  <input id="progress" inputMode="decimal" type="number" min="0" max="100" value={form.progress ?? 0} onChange={(e) => set('progress', e.target.value)} />
                  {errors.progress ? <div className="field-error">{errors.progress}</div> : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="modal-actions sticky-actions">
        <button type="button" className="button button-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" className="button button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : modeLabel}
        </button>
      </div>
    </form>
  )
}
