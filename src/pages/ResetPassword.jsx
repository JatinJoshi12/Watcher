import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'

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
    if (password.length < 6) return setError('Use at least 6 characters for the password.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      await updatePassword(password)
      setMessage('Password updated. You can keep using your account.')
      window.setTimeout(() => navigate('/', { replace: true }), 700)
    } catch (err) {
      setError(err.message || 'Unable to update password.')
    } finally { setLoading(false) }
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <div className="brand auth-brand"><span className="brand-mark">W</span><span className="brand-wordmark">Watcher</span></div>
        <div className="eyebrow">ACCOUNT SECURITY</div>
        <h1>Set a new password.</h1>
        <p className="auth-copy">Choose a new password for your Watcher account.</p>
        {message ? <div className="notice success-notice">{message}</div> : null}
        {error ? <div className="notice error-notice">{error}</div> : null}
        <form onSubmit={submit} className="auth-form">
          <div className="field"><label htmlFor="reset-password">New password</label><input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></div>
          <div className="field"><label htmlFor="reset-confirm">Confirm new password</label><input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></div>
          <button className="button button-primary button-wide" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </main>
  )
}
