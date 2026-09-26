import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../context'
import { Icon } from '../components/Icon'
import Poster from '../components/Poster'
import Modal from '../components/Modal'
import WatchlistManagerModal from '../components/WatchlistManagerModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { titleCaseText } from '../lib/utils'

function previewFor(items, listId) {
  return items
    .filter((item) => item.watchlist_id === listId)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 4)
}

export default function Watchlists({ notify }) {
  const navigate = useNavigate()
  const { watchlists, items, createWatchlist, updateWatchlist, deleteWatchlist } = useLibrary()
  const [managerOpen, setManagerOpen] = useState(false)
  const [editingList, setEditingList] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const counts = useMemo(
    () => Object.fromEntries(watchlists.map((list) => [list.id, items.filter((item) => item.watchlist_id === list.id).length])),
    [watchlists, items],
  )

  const openCreate = () => {
    setEditingList(null)
    setManagerOpen(true)
  }

  const openEdit = (list) => {
    setEditingList(list)
    setManagerOpen(true)
  }

  const create = async (payload) => {
    setSaving(true)
    try {
      const list = await createWatchlist(payload)
      notify?.(`Created ${list.name}.`, 'success')
      setEditingList(null)
      setManagerOpen(false)
      navigate('/watchlists', { replace: true })
      return list
    } finally {
      setSaving(false)
    }
  }

  const update = async (id, payload) => {
    setSaving(true)
    try {
      await updateWatchlist(id, payload)
      notify?.('Watch List Updated.', 'success')
      setEditingList(null)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await deleteWatchlist(deleteTarget.id)
      notify?.(`Deleted ${deleteTarget.name}.`, 'success')
      setDeleteTarget(null)
    } catch (error) {
      notify?.(error.message || 'Unable To Delete Watch List.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="watcher-watchlists-page">
      <div className="page-container">
        <section className="watcher-watchlists-heading-card">
          <div className="watcher-watchlists-heading-content">
            <div className="watcher-kicker">YOUR COLLECTIONS</div>
            <h1>My Watch List</h1>
          </div>
          <button className="watcher-create-button" onClick={openCreate}>
            <Icon name="plus" size={17} />
            <span>Create Watch List</span>
          </button>
        </section>

        {watchlists.length ? (
          <section className="watcher-playlist-grid">
            {watchlists.map((list) => {
              const preview = previewFor(items, list.id)
              const count = counts[list.id] || 0
              return (
                <article className="watcher-playlist-card" key={list.id}>
                  <button className="watcher-playlist-main" onClick={() => navigate(`/watchlists/${list.id}`)}>
                    <div className="watcher-playlist-cover">
                      <span className="watcher-playlist-cover-glow" />
                      {preview.length ? preview.map((item, index) => (
                        <Poster key={item.id} src={item.poster_url} alt={`${item.title} Poster`} title={item.title} className={`watcher-playlist-poster watcher-playlist-poster-${index + 1}`} />
                      )) : (
                        <div className="watcher-playlist-empty-cover">
                          <Icon name="list" size={30} />
                          <span>Your Collection</span>
                        </div>
                      )}
                    </div>
                    <div className="watcher-playlist-copy">
                      <h2>{titleCaseText(list.name)}</h2>
                      <p>{titleCaseText(list.description || 'A Collection Built Around The Stories You Want To Keep Close.')}</p>
                      <span>{count} {count === 1 ? 'Title' : 'Titles'}</span>
                    </div>
                  </button>

                  <div className="watcher-playlist-management">
                    <button className="watcher-square-action" onClick={(event) => { event.stopPropagation(); openEdit(list) }} aria-label={`Edit ${list.name}`}>
                      <Icon name="edit" size={15} />
                    </button>
                    <button className="watcher-square-action danger" onClick={(event) => { event.stopPropagation(); setDeleteTarget(list) }} aria-label={`Delete ${list.name}`}>
                      <Icon name="trash" size={15} />
                    </button>
                  </div>

                  <div className="watcher-playlist-actions">
                    <button className="watcher-open-list-button" onClick={() => navigate(`/watchlists/${list.id}`)}>
                      Open Watch List <Icon name="arrow" size={15} />
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        ) : null}
      </div>

      <Modal open={managerOpen} onClose={() => { if (!saving) { setManagerOpen(false); setEditingList(null) } }} title={editingList ? 'Edit Watch List' : 'Create Watch List'} size="medium" className="watcher-manager-modal">
        <WatchlistManagerModal
          watchlists={watchlists}
          initialEditing={editingList}
          onCreate={create}
          onUpdate={update}
          onDelete={setDeleteTarget}
          onClose={() => { setManagerOpen(false); setEditingList(null) }}
          saving={saving}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name || ''}?`}
        message="This Removes The Watch List And Every Title Saved Inside It."
        onConfirm={remove}
        onCancel={() => (saving ? null : setDeleteTarget(null))}
        loading={saving}
        confirmLabel="Delete Watch List"
      />
    </div>
  )
}
