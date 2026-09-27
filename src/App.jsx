import { useCallback, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, LibraryProvider, useAuth, useLibrary } from './context'
import Layout from './components/Layout'
import Modal from './components/Modal'
import ConfirmDialog from './components/ConfirmDialog'
import WatchlistForm from './components/WatchlistForm'
import Toast from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Discover from './pages/Discover'
import Watchlists from './pages/Watchlists'
import Watchlist from './pages/Watchlist'
import Detail from './pages/Detail'
import StreamPage from './pages/StreamPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ResetPassword from './pages/ResetPassword'
import NotFound from './pages/NotFound'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Stats from './pages/Stats'
import PublicProfile from './pages/PublicProfile'
import { RequireAuth } from './pages/AuthShell'
import { getWatchedAtPatch } from './lib/utils'
import { getTitleDetails } from './lib/tmdb'

function AppContent() {
  const { loading: authLoading, configured } = useAuth()
  const { addCatalogItem, updateItem, deleteItem } = useLibrary()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState(null)

  const notify = useCallback(
    (message, type = 'info') => setToast({ message, type, id: Date.now() }),
    [],
  )

  const openEdit = useCallback((item) => {
    setEditing(item)
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    if (!saving) {
      setFormOpen(false)
      setEditing(null)
    }
  }, [saving])

  const requestDelete = useCallback((item) => setDeleteTarget(item), [])

  const saveForm = async (payload) => {
    setSaving(true)
    try {
      let enrichedPayload = payload
      if (payload?.tmdb_id && payload?.type && (!editing || !editing.runtime_minutes)) {
        try {
          const details = await getTitleDetails(payload.tmdb_id, payload.type)
          enrichedPayload = {
            ...payload,
            runtime_minutes: details.runtime_minutes,
            episode_runtime_minutes: details.episode_runtime_minutes,
            total_episodes: details.total_episodes ?? payload.total_episodes ?? null,
            total_seasons: details.total_seasons ?? payload.total_seasons ?? null,
          }
        } catch {
          // Metadata is optional; title saving must still work.
        }
      }

      if (editing) {
        await updateItem(editing.id, {
          ...enrichedPayload,
          ...getWatchedAtPatch(editing, enrichedPayload.status),
        })
        notify('Title Updated.', 'success')
      } else {
        const result = await addCatalogItem([payload.watchlist_id], {
          ...enrichedPayload,
          ...(enrichedPayload.status === 'watched' ? { watched_at: new Date().toISOString() } : {}),
        })
        if (!result.created.length) throw new Error('That Title Is Already In The Selected WatchList.')
        notify('Title Added.', 'success')
      }
      setFormOpen(false)
      setEditing(null)
    } catch (error) {
      notify(error.message || 'Unable To Save This Title.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteItem(deleteTarget.id)
      notify('Title Deleted.', 'success')
      setDeleteTarget(null)
    } catch (error) {
      notify(error.message || 'Unable To Delete This Title.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading) return <div className="auth-loading">Loading Your Library…</div>

  const page = (element) => (
    <RequireAuth>
      <Layout>{element}</Layout>
    </RequireAuth>
  )

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={page(<Dashboard notify={notify} />)} />
        <Route path="/discover" element={page(<Discover notify={notify} />)} />
        <Route path="/watchlists" element={page(<Watchlists notify={notify} />)} />
        <Route path="/settings" element={page(<Settings notify={notify} />)} />
        <Route path="/profile" element={page(<Profile />)} />
        <Route path="/stats" element={page(<Stats />)} />
        <Route path="/users/:userId" element={page(<PublicProfile />)} />
        <Route
          path="/watchlists/:id"
          element={page(
            <Watchlist
              onEdit={openEdit}
              onDelete={requestDelete}
              notify={notify}
            />,
          )}
        />
        <Route
          path="/watchlists/:watchlistId/items/:itemId/stream"
          element={<RequireAuth><StreamPage notify={notify} /></RequireAuth>}
        />
        <Route
          path="/watchlists/:watchlistId/items/:itemId"
          element={page(<Detail notify={notify} />)}
        />
        <Route path="*" element={page(<NotFound />)} />
      </Routes>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit Title' : 'Manual Add'}
        size="large"
      >
        <WatchlistForm
          key={editing?.id || 'new'}
          initialData={editing}
          onSubmit={saveForm}
          onCancel={closeForm}
          submitting={saving}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete “${deleteTarget?.title || ''}”?`}
        message="This Removes The Title From The WatchList."
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
        loading={deleting}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
      {!configured ? <div className="development-corner">Local Mode</div> : null}
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <LibraryProvider>
            <AppContent />
          </LibraryProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
