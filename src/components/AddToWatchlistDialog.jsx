import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { titleCaseText } from '../lib/utils'

export default function AddToWatchlistDialog({ item, watchlists, existingListIds = [], onCreate, onConfirm, onCancel, saving }) {
  const existing = useMemo(() => new Set(existingListIds.map(String)), [existingListIds])
  const [selected, setSelected] = useState(() => new Set())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const toggle = (id) => {
    if (existing.has(String(id))) return

    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createList = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const list = await onCreate({ name, description })
      setSelected((current) => new Set([...current, list.id]))
      setName('')
      setDescription('')
    } finally {
      setCreating(false)
    }
  }

  const availableWatchlists = watchlists.filter((list) => !existing.has(String(list.id)))
  const alreadyEverywhere = watchlists.length > 0 && availableWatchlists.length === 0

  return (
    <div className="add-to-list-panel">
      <div className="selected-catalog-item">
        <PosterCompact item={item} />
        <div><strong>{titleCaseText(item.title)}</strong><span>{item.type === 'series' ? 'Web Series' : 'Movie'}{item.year ? ` · ${item.year}` : ''}</span></div>
      </div>
      <div className="dialog-section-label">{titleCaseText('Choose Watch Lists')}</div>
      <div className="watchlist-picker">
        {watchlists.map((list) => {
          const isExisting = existing.has(String(list.id))
          const isSelected = selected.has(list.id)
          return (
            <label className={`watchlist-option ${isSelected ? 'active' : ''} ${isExisting ? 'already-added' : ''}`} key={list.id}>
              <input
                type="checkbox"
                checked={isSelected || isExisting}
                disabled={isExisting}
                onChange={() => toggle(list.id)}
              />
              <span className="checkbox-mark"><Icon name="check" size={13} /></span>
              <span>
                <strong>{titleCaseText(list.name)}</strong>
                <small>{isExisting ? titleCaseText('Already Added') : titleCaseText(list.description || 'Personal Collection')}</small>
              </span>
            </label>
          )
        })}
        {!watchlists.length ? <div className="empty-inline">{titleCaseText('Create Your First Watch List Below.')}</div> : null}
      </div>
      <div className="create-list-inline">
        <div className="dialog-section-label">{titleCaseText('Create A New Watch List')}</div>
        <div className="inline-form-grid">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={titleCaseText('E.g. Horror Movies')} aria-label={titleCaseText('New Watch List Name')} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={titleCaseText('Optional Description')} aria-label={titleCaseText('New Watch List Description')} />
          <button className="button button-secondary" onClick={createList} disabled={creating || !name.trim()}>{creating ? titleCaseText('Creating…') : titleCaseText('Create')}</button>
        </div>
      </div>
      <div className="modal-actions">
        <button className="button button-secondary" onClick={onCancel}>{titleCaseText('Cancel')}</button>
        <button className="button button-primary" onClick={() => onConfirm([...selected])} disabled={saving || !selected.size || alreadyEverywhere}>
          {saving ? titleCaseText('Saving…') : alreadyEverywhere ? titleCaseText('Already In All Watch Lists') : titleCaseText('Add To Selected Watch Lists')}
        </button>
      </div>
    </div>
  )
}

function PosterCompact({ item }) {
  return item.poster_url ? <img className="picker-poster" src={item.poster_url} alt="" /> : <div className="picker-poster picker-fallback">WM</div>
}
