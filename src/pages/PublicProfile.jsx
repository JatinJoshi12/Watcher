import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProfile, getPublicStats } from '../lib/communityRepository'
import { Icon } from '../components/Icon'


export default function PublicProfile() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([getProfile(userId), getPublicStats(userId)])
      .then(([nextProfile, nextStats]) => {
        setProfile(nextProfile)
        setStats(nextStats)
      })
      .catch((err) => setError(err.message || 'Unable To Load This Profile.'))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="watcher-feature-page"><div className="page-container watcher-feature-container"><div className="watcher-feature-empty">Loading profile…</div></div></div>
  if (error || !profile) return <div className="watcher-feature-page"><div className="page-container watcher-feature-container"><button className="watcher-back-button" onClick={() => navigate('/discover')}><Icon name="back" size={16} /> Discover</button><div className="watcher-feature-empty watcher-error">{error || 'Profile not found.'}</div></div></div>

  return (
    <div className="watcher-feature-page watcher-public-profile-page">
      <div className="page-container watcher-feature-container">
        <button className="watcher-back-button" onClick={() => navigate('/discover')}><Icon name="back" size={16} /> Discover</button>
        <section className="watcher-public-profile-header">
          <img src={profile.avatar_url || '/avatars/avatar-1.jpg'} alt="Profile" />
          <div><span className="watcher-kicker">WATCHER PROFILE</span><h1>{profile.display_name || profile.username}</h1><p>@{profile.username}</p></div>
        </section>

        <section className="watcher-public-stats-stack">
          <article><span>Total Movies</span><strong>{stats?.total_movies_watched ?? 0}</strong></article>
          <article><span>Total Series</span><strong>{stats?.total_series_watched ?? 0}</strong></article>
          <article><span>Favourite Movie Genre</span><strong>{stats?.favourite_movie_genre || 'Not Enough Data'}</strong></article>
          <article><span>Favourite Series Genre</span><strong>{stats?.favourite_series_genre || 'Not Enough Data'}</strong></article>
        </section>
      </div>
    </div>
  )
}
