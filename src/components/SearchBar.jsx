import { Icon } from './Icon'

export default function SearchBar({ value, onChange, placeholder = 'Search movies, series, genres...' }) {
  return (
    <label className="search-field">
      <Icon name="search" size={19} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label="Search watchlist" />
      {value ? <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search"><Icon name="close" size={16} /></button> : null}
    </label>
  )
}
