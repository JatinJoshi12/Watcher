import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { getPublicStats } from '../lib/communityRepository'
import { formatDuration } from '../lib/stats'
import { searchCatalog, searchPeople, tmdbConfigured } from '../lib/tmdb'
import { AWARDS_2026, AWARD_SOURCES_2026 } from '../lib/awards'
import { Icon } from '../components/Icon'

function winnerPersonName(category, winner) {
  const parts = String(winner || '').split(' · ').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return ''
  if (/director|actor|actress/i.test(category)) return parts[0]
  if (/screenplay|cinematography|score/i.test(category)) return parts.slice(1).join(' · ')
  return ''
}

function AwardFilter({ value, options, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`watcher-award-filter ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="watcher-award-filter-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{value === 'All' ? 'All Awards' : value}</span>
        <Icon name="chevron" size={15} />
      </button>

      {open ? (
        <div className="watcher-award-filter-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              className={value === option ? 'active' : ''}
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
            >
              <span>{option === 'All' ? 'All Awards' : option}</span>
              {value === option ? <Icon name="check" size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AwardSection({ event, imageMap }) {
  return (
    <section className="watcher-stats-award-event">
      <div className="watcher-stats-award-heading">
        <div>
          <span className="watcher-kicker">{event.type}</span>
          <h3>{event.name} 2026</h3>
        </div>
        <a href={AWARD_SOURCES_2026[event.name]} target="_blank" rel="noreferrer">Official Results</a>
      </div>
      <div className="watcher-stats-award-list">
        {event.categories.map(([category, winner, title]) => {
          const titleImage = title ? imageMap.titles[title] : null
          const personName = winnerPersonName(category, winner)
          const personImage = personName ? imageMap.people[personName] : null
          const image = titleImage || personImage
          return (
            <div className="watcher-stats-award-row" key={`${event.name}-${category}`}>
              <div className="watcher-stats-award-image">
                {image ? <img src={image} alt="" /> : <Icon name="grid" size={18} />}
              </div>
              <div className="watcher-stats-award-copy">
                <span>{category}</span>
                <strong>{winner}</strong>
              </div>
              <em>Winner</em>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function Stats() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [awardImages, setAwardImages] = useState({ titles: {}, people: {} })
  const [awardFilter, setAwardFilter] = useState('All')

  useEffect(() => {
    if (!user?.id) return
    getPublicStats(user.id)
      .then(setStats)
      .catch((err) => setError(err.message || 'Unable To Load Your Stats.'))
  }, [user?.id])

  useEffect(() => {
    if (!tmdbConfigured) return undefined
    let active = true
    const titleSet = new Set(AWARDS_2026.flatMap((event) => event.categories.map(([, , title]) => title).filter(Boolean)))
    const personSet = new Set()
    AWARDS_2026.forEach((event) => event.categories.forEach(([category, winner]) => {
      const person = winnerPersonName(category, winner)
      if (person) personSet.add(person)
    }))

    ;(async () => {
      const images = { titles: {}, people: {} }
      for (const title of titleSet) {
        try {
          const [movie, series] = await Promise.all([
            searchCatalog(title, { type: 'movie', page: 1 }),
            searchCatalog(title, { type: 'series', page: 1 }),
          ])
          const match = [...(movie.results || []), ...(series.results || [])]
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0]
          if (match?.poster_url) images.titles[title] = match.poster_url
        } catch { /* keep text */ }
      }
      for (const person of personSet) {
        try {
          const data = await searchPeople(person, { page: 1 })
          const match = (data.results || []).sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0]
          if (match?.profile_url) images.people[person] = match.profile_url
        } catch { /* keep text */ }
      }
      if (active) setAwardImages(images)
    })()
    return () => { active = false }
  }, [])

  const events = useMemo(
    () => awardFilter === 'All' ? AWARDS_2026 : AWARDS_2026.filter((event) => event.name === awardFilter),
    [awardFilter],
  )


  const values = [
    ['Total Series', stats?.total_series_watched ?? '—'],
    ['Total Movies', stats?.total_movies_watched ?? '—'],
    ['Favourite Series Genre', stats?.favourite_series_genre || 'Not Enough Data'],
    ['Favourite Movie Genre', stats?.favourite_movie_genre || 'Not Enough Data'],
    ['Series Watch Time', formatDuration(stats?.total_series_watch_time_minutes || 0, true)],
    ['Movie Watch Time', formatDuration(stats?.total_movie_watch_time_minutes || 0)],
  ]

  return (
    <div className="watcher-feature-page watcher-features-page">
      <div className="page-container watcher-feature-container">
        <button className="watcher-back-button" onClick={() => navigate('/')}>
          <Icon name="back" size={16} /> Home
        </button>

        <section className="watcher-feature-heading watcher-features-heading">
          <span className="watcher-kicker">WATCHER FEATURES</span>
          <h1>Features</h1>
          <p>Stats and awards, gathered in one place.</p>
        </section>

        <div className="watcher-features-tabs" role="tablist" aria-label="Features">
          <button type="button" className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')} role="tab" aria-selected={activeTab === 'stats'}>
            <Icon name="chart" size={16} /> Stats
          </button>
          <button type="button" className={activeTab === 'awards' ? 'active' : ''} onClick={() => setActiveTab('awards')} role="tab" aria-selected={activeTab === 'awards'}>
            <Icon name="award" size={16} /> Awards
          </button>
        </div>

        {error ? <div className="watcher-feature-empty watcher-error">{error}</div> : null}

        {activeTab === 'stats' ? (
          <section className="watcher-stats-stack" role="tabpanel">
            {values.map(([label, value]) => (
              <article className="watcher-stats-stack-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
        ) : (
          <section className="watcher-stats-feature-section watcher-stats-awards-section" role="tabpanel">
            <div className="watcher-stats-feature-heading watcher-stats-awards-title-row">
              <div>
                <span className="watcher-kicker">2026 RESULTS</span>
                <h2>Awards</h2>
                <p>Major film and television winners, with artwork where Watcher can match the title or person.</p>
              </div>
              <AwardFilter
                value={awardFilter}
                options={['All', ...AWARDS_2026.map((event) => event.name)]}
                onChange={setAwardFilter}
              />
            </div>
            {events.map((event) => <AwardSection key={event.name} event={event} imageMap={awardImages} />)}
          </section>
        )}
      </div>
    </div>
  )
}
