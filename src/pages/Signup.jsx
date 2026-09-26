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

const avatarChoices = Array.from(
  { length: 10 },
  (_, index) => `/avatars/avatar-${index + 1}.jpg`,
)

export default function Signup() {
  const { signUp, configured } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(avatarChoices[0])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    const name = displayName.trim()
    const cleanUsername = username.trim().replace(/^@+/, '').toLowerCase()

    if (name.length < 2) {
      setError(formatErrorMessage('Please Enter A Display Name.'))
      return
    }

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError(formatErrorMessage('Username Must Be 3–24 Characters Using Letters, Numbers, Or Underscores.'))
      return
    }

    if (password.length < 6) {
      setError(formatErrorMessage('Use At Least 6 Characters For The Password.'))
      return
    }

    if (password !== confirm) {
      setError(formatErrorMessage('Passwords Do Not Match.'))
      return
    }

    setLoading(true)

    try {
      if (!configured) {
        localStorage.setItem('watchlist_display_name', name)
        localStorage.setItem('watchlist_avatar_url', avatarUrl)
        navigate('/')
        return
      }

      const data = await signUp(email.trim(), password, {
        displayName: name,
        username: cleanUsername,
        avatarUrl,
      })

      if (data.session) {
        navigate('/', { replace: true })
      } else {
        setMessage(
          'Account Created. Check Your Email If Confirmation Is Enabled.',
        )
      }
    } catch (err) {
      setError(formatErrorMessage(err?.message || 'Unable To Create Account.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicOnly>
      <main className="auth-page auth-background-page signup-auth-page">

        <div className="auth-panel cinematic-auth-panel signup-panel">
          <div className="signup-heading-row">
            <div className="brand auth-brand cinematic-auth-brand">
              <span className="brand-wordmark">Watcher</span>
            </div>
            <span className="signup-step">NEW PROFILE</span>
          </div>

          <div className="eyebrow">CREATE YOUR WATCHER PROFILE</div>

          <div className="auth-tabs">
            <button
              className="auth-tab"
              type="button"
              onClick={() => navigate('/login')}
            >
              Sign In
            </button>
            <button className="auth-tab active" type="button">
              Create Account
            </button>
          </div>

          <h1>Make It Yours.</h1>

          <p className="auth-copy">
            Set up your profile once, then keep every movie and series in one place.
          </p>

          {message ? <div className="notice success-notice">{message}</div> : null}
          {error ? <div className="notice error-notice">{error}</div> : null}

          <form onSubmit={submit} className="auth-form">
            <div className="field">
              <label htmlFor="signup-name">Display Name</label>
              <input
                id="signup-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                placeholder="Your Name"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="signup-username">Username</label>
              <input
                id="signup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                autoComplete="username"
                placeholder="your_username"
                minLength={3}
                maxLength={24}
                required
              />
            </div>

            <div className="signup-profile-picker">
              <div className="signup-profile-copy">
                <span className="signup-field-kicker">PROFILE PICTURE</span>
                <strong>Pick Your Look</strong>
                <small>Choose one of the ten Watcher avatars.</small>
              </div>

              <div
                className="avatar-choice-grid reference-avatar-grid signup-avatar-grid"
                role="radiogroup"
                aria-label="Choose Profile Picture"
              >
                {avatarChoices.map((src, index) => (
                  <label
                    key={src}
                    className={`avatar-choice ${avatarUrl === src ? 'selected' : ''}`}
                    title={`Profile Picture ${index + 1}`}
                  >
                    <input
                      type="radio"
                      name="profile-avatar"
                      value={src}
                      checked={avatarUrl === src}
                      onChange={() => setAvatarUrl(src)}
                    />
                    <img src={src} alt={`Profile Picture ${index + 1}`} />
                  </label>
                ))}
              </div>
            </div>

            <div className="signup-form-pair">
              <div className="field">
                <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email"
                required
              />
              </div>

              <div className="field">
                <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Password"
                required
              />
              </div>
            </div>

            <div className="field signup-confirm-field">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Confirm Password"
                required
              />
            </div>

            <button
              className="button button-primary button-wide cinematic-submit"
              disabled={loading}
            >
              {loading
                ? 'Creating Account…'
                : configured
                  ? 'Create Account'
                  : 'Enter Local Mode'}
            </button>
          </form>

          <AuthFooter mode="signup" />
        </div>
      </main>
    </PublicOnly>
  )
}
