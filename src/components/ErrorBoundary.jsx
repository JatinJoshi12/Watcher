import { Component } from 'react'
import { Icon } from './Icon'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Watchlist Maker render error:', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="error-page">
        <div className="error-card">
          <div className="eyebrow">WATCHLIST MAKER</div>
          <h1>Something went wrong.</h1>
          <p>Try refreshing the page. Your saved data is kept separately from the UI.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>
            <Icon name="refresh" />
            Refresh page
          </button>
        </div>
      </main>
    )
  }
}
