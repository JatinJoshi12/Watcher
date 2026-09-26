import { useEffect, useState } from 'react'
import { Icon } from './Icon'

export default function WatchlistManagerModal({ initialEditing, onCreate, onUpdate, onClose, saving }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    setName(initialEditing?.name || '')
    setDescription(initialEditing?.description || '')
  }, [initialEditing])

  const editing = Boolean(initialEditing)

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    if (editing) {
      await onUpdate(initialEditing.id, {
        name: name.trim(),
        description: description.trim(),
      })
    } else {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
      })
    }

    setName('')
    setDescription('')
  }

  return (
    <form className="watcher-manager-form" onSubmit={submit}>
      <div className="watcher-manager-art" />

      <div className="watcher-manager-fields">
        <div className="watcher-modal-field">
          <label htmlFor="watchlist-name">Watch List Name</label>
          <input
            id="watchlist-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Web Series Watch List"
            autoFocus
            maxLength={60}
            required
          />
        </div>

        <div className="watcher-modal-field">
          <label htmlFor="watchlist-description">Description</label>
          <textarea
            id="watchlist-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short description for this collection..."
            rows={3}
            maxLength={180}
          />
        </div>
      </div>

      <div className="watcher-modal-actions">
        <button type="button" className="watcher-secondary-button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="watcher-primary-button" disabled={saving || !name.trim()}>
          <Icon name={editing ? 'check' : 'plus'} size={15} />
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Watch List'}
        </button>
      </div>
    </form>
  )
}
