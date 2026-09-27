import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { PublicOnly, AuthFooter } from './AuthShell'

const titleCaseConnectors = new Set([
  'and',
  'or',
  'of',
  'the',
  'in',
  'on',
  'for',
  'to',
  'with',
  'from',
  'a',
  'an',
  'as',
  'at',
  'by',
])

function formatErrorMessage(value = '') {
  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && titleCaseConnectors.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

export default function Login() {
  const { signIn, resetPassword, configured } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (!configured) {
        navigate('/')
        return
      }

      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      const errorMessage = err?.message?.trim() === 'Invalid login credentials'
        ? 'Invalid Login Credentials'
        : (err?.message || 'Unable To Sign In.')

      setError(formatErrorMessage(errorMessage))
    } finally {
      setLoading(false)
    }
  }

  const reset = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      await resetPassword(email.trim())
      setMessage('Password Reset Email Sent. Check Your Inbox.')
      setResetMode(false)
    } catch (err) {
      setError(formatErrorMessage(err?.message || 'Unable To Send Reset Email.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicOnly>
      <main className="auth-page auth-background-page">

        <div className="auth-panel cinematic-auth-panel">
          <div className="brand auth-brand cinematic-auth-brand">
            <span className="brand-wordmark">Watcher</span>
          </div>

          <div className="eyebrow">PLAN TODAY. WATCH TOMORROW.</div>

          <div className="auth-tabs">
            <button className="auth-tab active" type="button">
              Sign In
            </button>
            <button
              className="auth-tab"
              type="button"
              onClick={() => navigate('/signup')}
            >
              Create Account
            </button>
          </div>

          <h1>{resetMode ? 'Reset Your Password.' : 'Welcome Back.'}</h1>

          <p className="auth-copy">
            Keep Your Movies And Series Organized Across Every Device You Use.
          </p>

          {message ? <div className="notice success-notice">{message}</div> : null}
          {error ? <div className="notice error-notice">{error}</div> : null}

          <form onSubmit={resetMode ? reset : submit} className="auth-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email"
                required
              />
            </div>

            {!resetMode ? (
              <div className="field">
                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setResetMode(true)}
                  >
                    Forgot Password?
                  </button>
                </div>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Password"
                  required
                />
              </div>
            ) : null}

            <button
              className="button button-primary button-wide cinematic-submit"
              disabled={loading}
            >
              {loading
                ? 'Signing In…'
                : resetMode
                  ? 'Send Reset Email'
                  : configured
                    ? 'Sign In'
                    : 'Enter Local Mode'}
            </button>

            {resetMode ? (
              <button
                type="button"
                className="button button-secondary button-wide"
                onClick={() => setResetMode(false)}
              >
                Back to Sign In
              </button>
            ) : null}
          </form>

          <AuthFooter mode="login" />
        </div>
      </main>
    </PublicOnly>
  )
}
