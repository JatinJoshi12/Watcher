import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { getProfile, getPublicStats } from '../lib/communityRepository'
import { formatHours } from '../lib/stats'
import { Icon } from '../components/Icon'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    Promise.all([getProfile(user.id), getPublicStats(user.id)])
      .then(([nextProfile, nextStats]) => {
        setProfile(nextProfile)
        setStats(nextStats)
      })
      .catch(() => null)
  }, [user?.id])

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Watcher'
  const username = profile?.username || user?.user_metadata?.username || 'watcher'
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || '/avatars/avatar-1.jpg'
  const totalMinutes = (stats?.total_movie_watch_time_minutes || 0) + (stats?.total_series_watch_time_minutes || 0)

  return (
    <div className="watcher-feature-page watcher-profile-page">
      <div className="page-container watcher-feature-container">
        <button className="watcher-back-button" onClick={() => navigate('/')}>
          <Icon name="home" size={16} /> Home
        </button>

        <section className="watcher-profile-hero">
          <div className="watcher-profile-identity">
            <img src={avatar} alt="Profile" />
            <div>
              <span className="watcher-kicker">YOUR WATCHER PROFILE</span>
              <h1>{displayName}</h1>
              <p>@{username}</p>
            </div>
          </div>
          <button className="watcher-secondary-button" onClick={() => navigate('/settings')}>
            <Icon name="settings" size={15} /> Profile Settings
          </button>
        </section>

        <section className="watcher-profile-summary">
          <div><span>Movies Watched</span><strong>{stats?.total_movies_watched ?? 0}</strong></div>
          <div><span>Series Watched</span><strong>{stats?.total_series_watched ?? 0}</strong></div>
          <div><span>Total Watch Time</span><strong>{formatHours(totalMinutes)}</strong></div>
        </section>

        <section className="watcher-feature-tools">
          <div className="watcher-feature-section-heading">
            <div>
              <span className="watcher-kicker">WATCHER TOOLS</span>
              <h2>Features</h2>
            </div>
          </div>
          <button className="watcher-feature-tool" onClick={() => navigate('/stats')}>
            <span className="watcher-feature-tool-icon"><Icon name="chart" size={18} /></span>
            <span><strong>Features</strong><small>Open Stats and Awards for your Watcher profile.</small></span>
            <Icon name="arrow" size={16} />
          </button>
        </section>
      </div>
    </div>
  )
}
