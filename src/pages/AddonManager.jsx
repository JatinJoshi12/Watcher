import { useEffect, useState } from 'react'
import { fetchManifest, getConfiguredAddons, removeAddon, toggleAddon } from '../lib/stremioAddons'
import { Icon } from '../components/Icon'

export default function AddonManager({ notify }) {
  const [addons, setAddons] = useState(() => getConfiguredAddons())
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState({})

  const test = async (addon) => {
    setChecking(true)
    try {
      const manifest = await fetchManifest(addon.manifestUrl)
      setStatus((current) => ({ ...current, [addon.manifestUrl]: `OK · ${manifest.name}` }))
    } catch (error) {
      setStatus((current) => ({ ...current, [addon.manifestUrl]: `Error · ${error.message}` }))
    } finally {
      setChecking(false)
    }
  }

  const setEnabled = (addon, enabled) => {
    const next = toggleAddon(addon.manifestUrl, enabled)
    setAddons(next)
  }

  return (
    <div className="watcher-settings-page">
      <div className="page-container watcher-settings-container">
        <div className="watcher-settings-top">
          <a className="watcher-back-button" href="/settings"><Icon name="back" size={16} /> Settings</a>
          <span className="watcher-settings-top-label">STREAM ADDONS</span>
        </div>

        <section className="watcher-settings-title">
          <span className="watcher-kicker">SOURCE ENGINE</span>
          <h1>Your Addons.</h1>
          <p>Watcher scans enabled Stremio-compatible addons and automatically selects direct browser-playable HTTP/HLS sources.</p>
        </section>

        <div className="watcher-addon-manager">
          {addons.map((addon) => (
            <article className="watcher-addon-card" key={addon.manifestUrl}>
              <div className="watcher-addon-main">
                <div className="watcher-addon-title-row">
                  <div>
                    <span className="watcher-kicker">{addon.autoPlay ? 'PLAYBACK' : 'CATALOG / MANUAL'}</span>
                    <h2>{addon.name}</h2>
                  </div>
                  <label className="watcher-addon-toggle">
                    <input type="checkbox" checked={addon.enabled} onChange={(event) => setEnabled(addon, event.target.checked)} />
                    <span />
                  </label>
                </div>
                <input className="watcher-addon-url" value={addon.manifestUrl} readOnly aria-label={`${addon.name} manifest URL`} />
                <p>{addon.note}</p>
                {status[addon.manifestUrl] ? <div className="watcher-addon-status">{status[addon.manifestUrl]}</div> : null}
              </div>
              <div className="watcher-addon-actions">
                <button className="watcher-secondary-button" type="button" disabled={checking} onClick={() => test(addon)}>Test Manifest</button>
                {!['mediafusion','thepiratebay-plus','torrentio','torrentsdb','ilcorsaroviola','streaming-catalogs','stremify','bharat-binge','india-streams','tvvoo','audiobookbay','aioratings','marvel','flix-streams','free-flix-streams'].includes(addon.id) ? (
                  <button className="watcher-danger-button" type="button" onClick={() => { const next = removeAddon(addon.manifestUrl); setAddons(next); }}>Remove</button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
