import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context'
import { Icon } from './Icon'

export default function Layout({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const displayName = user?.user_metadata?.display_name?.trim() || user?.email?.split('@')[0] || 'Guest'
  const avatarUrl = user?.user_metadata?.avatar_url || ''
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="watcher-shell">
      <header className="watcher-topbar">
        <div className="watcher-topbar-inner">
          <NavLink to="/" className="watcher-brand" aria-label="Watcher Home">
            <img src="/watcher-logo.png" alt="Watcher" className="watcher-brand-logo" />
            <span className="watcher-brand-text">Watcher</span>
          </NavLink>

          <nav className="watcher-nav-pill" aria-label="Primary Navigation">
            <NavLink to="/" end className={({ isActive }) => `watcher-nav-button ${isActive ? 'active' : ''}`}>
              <Icon name="home" size={17} />
              <span>Home</span>
            </NavLink>
            <NavLink to="/watchlists" className={({ isActive }) => `watcher-nav-button ${isActive || location.pathname.startsWith('/watchlists/') ? 'active' : ''}`}>
              <Icon name="list" size={17} />
              <span>My Watch List</span>
            </NavLink>
          </nav>

          <div className="watcher-topbar-actions">
            <button className="watcher-discover-button" onClick={() => navigate('/discover')}>
              <Icon name="search" size={18} />
              <span>Discover</span>
            </button>
            <button className="watcher-stats-button" onClick={() => navigate('/stats')}>
              <Icon name="chart" size={18} />
              <span>Features</span>
            </button>
            <button className="watcher-settings-button" onClick={() => navigate('/addons')} aria-label="Open Stream Addons" title="Stream Addons">
              <Icon name="play" size={18} />
            </button>
            <button className="watcher-settings-button" onClick={() => navigate('/settings')} aria-label="Open Settings" title="Settings">
              <Icon name="settings" size={18} />
            </button>
            <div className="watcher-profile" aria-label={`${displayName} Profile`}>
              {avatarUrl ? <img src={avatarUrl} alt="Profile" className="watcher-profile-avatar" /> : <span className="watcher-profile-avatar watcher-profile-initial">{initial}</span>}
              <span className="watcher-profile-name">{displayName}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="watcher-main">{children}</main>
    </div>
  )
}
