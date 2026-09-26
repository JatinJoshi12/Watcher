import WatchlistCard from './WatchlistCard'

export default function WatchlistGrid({ items, ...handlers }) {
  if (!items.length) return null
  return <div className="watchlist-grid">{items.map((item) => <WatchlistCard key={item.id} item={item} {...handlers} />)}</div>
}
