import { GENRES, LANGUAGES, PLATFORMS } from '../lib/validators'
import { Icon } from './Icon'

const filterDefaults = { type: '', status: '', genre: '', year: '', platform: '', language: '', favorite: false }

export default function FilterBar({ filters, setFilters, sortOption, setSortOption, onClear }) {
  const active = Object.entries(filters).filter(([key, value]) => value && key !== 'search')
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const resetDefault = () => setFilters({ ...filterDefaults })

  return (
    <div className="filter-area">
      <div className="filter-controls">
        <div className="select-wrap">
          <span className="sr-only">Type filter</span>
          <select value={filters.type} onChange={(e) => update('type', e.target.value)}>
            <option value="">All types</option>
            <option value="movie">Movies</option>
            <option value="series">Web Series</option>
          </select>
          <Icon name="chevron" size={15} />
        </div>
        <div className="select-wrap">
          <span className="sr-only">Status filter</span>
          <select value={filters.status} onChange={(e) => update('status', e.target.value)}>
            <option value="">All status</option>
            <option value="unwatched">Unwatched</option>
            <option value="watched">Watched</option>
          </select>
          <Icon name="chevron" size={15} />
        </div>
        <div className="select-wrap optional-filter">
          <span className="sr-only">Genre filter</span>
          <select value={filters.genre} onChange={(e) => update('genre', e.target.value)}>
            <option value="">All genres</option>
            {GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
          </select>
          <Icon name="chevron" size={15} />
        </div>
        <div className="select-wrap optional-filter">
          <span className="sr-only">Platform filter</span>
          <select value={filters.platform} onChange={(e) => update('platform', e.target.value)}>
            <option value="">All platforms</option>
            {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
          </select>
          <Icon name="chevron" size={15} />
        </div>
        <div className="select-wrap optional-filter">
          <span className="sr-only">Language filter</span>
          <select value={filters.language} onChange={(e) => update('language', e.target.value)}>
            <option value="">All languages</option>
            {LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
          <Icon name="chevron" size={15} />
        </div>
        <label className={`filter-toggle ${filters.favorite ? 'active' : ''}`}>
          <input type="checkbox" checked={filters.favorite} onChange={(e) => update('favorite', e.target.checked)} />
          <Icon name="heart" size={16} /> Favorites
        </label>
        <div className="select-wrap sort-select">
          <span className="sr-only">Sort results</span>
          <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
            <option value="created_desc">Recently added</option>
            <option value="updated_desc">Recently updated</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
            <option value="year_desc">Year newest</option>
            <option value="year_asc">Year oldest</option>
            <option value="rating_desc">Rating highest</option>
            <option value="rating_asc">Rating lowest</option>
          </select>
          <Icon name="sort" size={16} />
        </div>
      </div>
      {active.length > 0 ? (
        <div className="active-filters">
          {active.map(([key, value]) => (
            <button key={key} className="filter-chip" onClick={() => update(key, false)}>
              {key === 'favorite' ? 'Favorites' : String(value)} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button className="text-button" onClick={() => { resetDefault(); onClear?.() }}>Clear filters</button>
        </div>
      ) : null}
    </div>
  )
}
