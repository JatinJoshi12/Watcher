import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { Icon } from '../components/Icon'
import { getProfile } from '../lib/communityRepository'
import AddonSettingsPanel from '../components/AddonSettingsPanel'

const avatars = Array.from({ length: 10 }, (_, index) => `/avatars/avatar-${index + 1}.jpg`)

export default function Settings({ notify }) {
  const { user, updateProfile, signOut, configured } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '')
  const [username, setUsername] = useState(user?.user_metadata?.username || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || avatars[0])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!configured || !user?.id) return
    getProfile(user.id).then((profile) => {
      if (profile) {
        setUsername(profile.username || '')
        if (!displayName && profile.display_name) setDisplayName(profile.display_name)
      }
    }).catch(() => null)
    // Profile values are loaded once when Settings opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, user?.id])

  const save = async (event) => {
    event.preventDefault()
    const name = displayName.trim()
    const cleanUsername = username.trim().replace(/^@+/, '').toLowerCase()
    if (name.length < 2) {
      notify?.('Display Name Must Be At Least 2 Characters.', 'error')
      return
    }
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      notify?.('Username Must Be 3–24 Characters Using Letters, Numbers, Or Underscores.', 'error')
      return
    }

    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({ displayName: name, avatarUrl, username: cleanUsername })
      setSaved(true)
      notify?.('Profile Updated.', 'success')
    } catch (error) {
      notify?.(error.message || 'Unable To Update Profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const logout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="watcher-settings-page">
      <div className="page-container watcher-settings-container">
        <div className="watcher-settings-top">
          <button className="watcher-back-button" onClick={() => navigate('/')}>
            <Icon name="home" size={16} />
            Home
          </button>
          <span className="watcher-settings-top-label">PROFILE SETTINGS</span>
        </div>

        <section className="watcher-settings-title">
          <span className="watcher-kicker">YOUR SPACE</span>
          <h1>Make It Yours.</h1>
        </section>

        <form className="watcher-settings-card" onSubmit={save}>
          <div className="watcher-settings-preview">
            <div className="watcher-settings-avatar">
              <img src={avatarUrl || avatars[0]} alt="Selected Profile" />
            </div>
            <div>
              <span className="watcher-kicker">CURRENT PROFILE</span>
              <h2>{displayName.trim() || 'Your Name'}</h2>
              <strong>{user?.email || 'Local Account'}</strong>
              {saved ? <span className="watcher-saved-profile">Profile Updated</span> : null}
            </div>
          </div>

          <div className="watcher-settings-divider" />

          <div className="watcher-settings-field">
            <label htmlFor="settings-display-name">Display Name</label>
            <input
              id="settings-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={40}
              placeholder="Your Name"
            />
          </div>

          <div className="watcher-settings-field">
            <label htmlFor="settings-username">Username</label>
            <input
              id="settings-username"
              value={username}
              onChange={(event) => setUsername(event.target.value.replace(/\s/g, ''))}
              maxLength={24}
              placeholder="your_username"
              autoComplete="username"
            />
          </div>

          <div className="watcher-settings-field">
            <label>Profile Picture</label>
            <div className="watcher-settings-avatar-grid" role="radiogroup" aria-label="Choose Profile Picture">
              {avatars.map((src, index) => (
                <label className={`watcher-settings-avatar-choice ${avatarUrl === src ? 'selected' : ''}`} key={src}>
                  <input
                    type="radio"
                    name="settings-avatar"
                    value={src}
                    checked={avatarUrl === src}
                    onChange={() => setAvatarUrl(src)}
                  />
                  <img src={src} alt={`Profile Picture ${index + 1}`} />
                </label>
              ))}
            </div>
          </div>

          <div className="watcher-email-card">
            <Icon name="grid" size={19} />
            <div>
              <span>Email</span>
              <strong>{user?.email || 'Local Account'}</strong>
            </div>
          </div>

          <div className="watcher-settings-actions">
            <button className="watcher-primary-button watcher-glow-button" disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {configured ? (
              <button type="button" className="watcher-danger-button watcher-glow-button" onClick={logout}>
                <Icon name="logout" size={16} />
                Log Out
              </button>
            ) : null}
          </div>
        </form>

        <AddonSettingsPanel notify={notify} />
      </div>
    </div>
  )
}
