import Modal from './Modal'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, loading = false }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="small" className="watcher-delete-modal">
      <div className="watcher-delete-body">
        <div className="watcher-delete-icon">!</div>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button className="button button-secondary watcher-action-button" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="button button-danger watcher-action-button" onClick={onConfirm} disabled={loading}>{loading ? 'Deleting…' : confirmLabel}</button>
        </div>
      </div>
    </Modal>
  )
}
