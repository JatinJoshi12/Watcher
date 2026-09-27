import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'

const messageConnectors = new Set([
  'and', 'or', 'of', 'the', 'in', 'on', 'for', 'to', 'with', 'from',
  'a', 'an', 'as', 'at', 'by', 'do', 'not',
])

function formatMessage(value = '') {
  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && messageConnectors.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

export default function ResetPassword() {
  const { updatePassword, configured } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!configured) return navigate('/login', { replace: true })
    if (password.length < 6) return setError(formatMessage('Use at least 6 characters for the password.'))
    if (password !== confirm) return setError(formatMessage('Passwords do not match.'))
    setLoading(true)
    try {
      await updatePassword(password)
      setMessage(formatMessage('Password updated. You can keep using your account.'))
      window.setTimeout(() => navigate('/', { replace: true }), 700)
    } catch (err) {
      setError(formatMessage(err.message || 'Unable to update password.'))
    } finally { setLoading(false) }
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <div className="brand auth-brand"><span className="brand-mark">W</span><span className="brand-wordmark">Watcher</span></div>
        <div className="eyebrow">ACCOUNT SECURITY</div>
        <h1>Set a New Password.</h1>
        <p className="auth-copy">Choose a New Password for Your Watcher Account.</p>
        {message ? <div className="notice success-notice">{message}</div> : null}
        {error ? <div className="notice error-notice">{error}</div> : null}
        <form onSubmit={submit} className="auth-form">
          <div className="field"><label htmlFor="reset-password">New Password</label><input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></div>
          <div className="field"><label htmlFor="reset-confirm">Confirm New Password</label><input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></div>
          <button className="button button-primary button-wide" disabled={loading}>{loading ? 'Updating…' : 'Update Password'}</button>
        </form>
      </div>
    </main>
  )
}
