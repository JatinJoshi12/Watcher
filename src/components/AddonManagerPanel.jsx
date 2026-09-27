import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import {
  fetchManifest,
  getConfiguredAddons,
  removeConfiguredAddon,
  saveConfiguredAddons,
  upsertConfiguredAddon,
} from '../lib/stremioAddons'

function typeLabel(kind) {
  if (kind === 'subtitles') return 'SUBTITLES'
  if (kind === 'next') return 'NEXT WATCH'
  return 'STREAMING'
}

export default function AddonManagerPanel({ notify }) {
  const [addons, setAddons] = useState(() => getConfiguredAddons())
  const [newUrl, setNewUrl] = useState('')
  const [testing, setTesting] = useState(null)
  const [status, setStatus] = useState({})

  const configuredCount = useMemo(() => addons.filter((addon) => addon.enabled && addon.manifestUrl).length, [addons])

  const update = (next) => {
    setAddons(next)
    saveConfiguredAddons(next)
  }

  const testAddon = async (addon) => {
    if (!addon.manifestUrl) {
      notify?.(`${addon.name} Needs Its Manifest URL.`, 'error')
      return
    }
    setTesting(addon.id)
    setStatus((current) => ({ ...current, [addon.id]: { loading: true, message: 'Testing…' } }))
    try {
      const { manifest } = await fetchManifest(addon.manifestUrl)
      setStatus((current) => ({
        ...current,
        [addon.id]: {
          loading: false,
          ok: true,
          message: `Connected · ${manifest.version || 'unknown version'}`,
        },
      }))
      notify?.(`${addon.name} Manifest Works.`, 'success')
    } catch (error) {
      setStatus((current) => ({
        ...current,
        [addon.id]: { loading: false, ok: false, message: error.message || 'Failed.' },
      }))
      notify?.(`${addon.name} Could Not Be Reached.`, 'error')
    } finally {
      setTesting(null)
    }
  }

  const addCustom = async () => {
    const url = newUrl.trim()
    if (!url) return
    setTesting('custom')
    try {
      const { manifest, finalUrl } = await fetchManifest(url)
      const resources = (manifest.resources || []).map((resource) => typeof resource === 'string' ? resource : resource?.name).filter(Boolean)
      const kind = resources.length === 1 && resources[0] === 'subtitles' ? 'subtitles' : (manifest.name?.toLowerCase().includes('watch next') ? 'next' : 'stream')
      const next = upsertConfiguredAddon({
        id: manifest.id,
        name: manifest.name,
        kind,
        manifestUrl: finalUrl || url,
        enabled: true,
        description: manifest.description || 'Custom Stremio addon.',
      })
      setAddons(next)
      setNewUrl('')
      notify?.(`${manifest.name} Added.`, 'success')
    } catch (error) {
      notify?.(error.message || 'Invalid Addon Manifest.', 'error')
    } finally {
      setTesting(null)
    }
  }

  const handleRemove = (addon) => {
    const next = removeConfiguredAddon(addon.manifestUrl)
    setAddons(next)
    notify?.(`${addon.name} Removed.`, 'info')
  }

  return (
    <section className="watcher-addon-settings-section">
      <div className="watcher-addon-settings-heading">
        <div>
          <span className="watcher-kicker">STREAMING SYSTEM</span>
          <h2>Addons</h2>
          <p>Watcher checks these Stremio-compatible services automatically when you open a title.</p>
        </div>
        <strong>{configuredCount} Enabled</strong>
      </div>

      <div className="watcher-addon-list">
        {addons.map((addon) => {
          const currentStatus = status[addon.id]
          return (
            <div className="watcher-addon-row" key={addon.id}>
              <div className="watcher-addon-main">
                <div className="watcher-addon-title-line">
                  <strong>{addon.name}</strong>
                  <span>{typeLabel(addon.kind)}</span>
                  {currentStatus?.ok ? <em className="watcher-addon-ok">READY</em> : null}
                  {currentStatus?.ok === false ? <em className="watcher-addon-bad">ERROR</em> : null}
                </div>
                <input
                  className="watcher-addon-url"
                  value={addon.manifestUrl || ''}
                  onChange={(event) => {
                    const value = event.target.value
                    update(addons.map((entry) => entry.id === addon.id ? { ...entry, manifestUrl: value } : entry))
                  }}
                  placeholder={addon.requiresConfiguration ? 'Paste your personal manifest URL' : 'Manifest URL'}
                  aria-label={`${addon.name} manifest URL`}
                />
                <small>{currentStatus?.message || addon.description || 'Stremio-compatible addon.'}</small>
              </div>
              <div className="watcher-addon-row-actions">
                <label className="watcher-addon-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(addon.enabled && addon.manifestUrl)}
                    disabled={!addon.manifestUrl}
                    onChange={(event) => update(addons.map((entry) => entry.id === addon.id ? { ...entry, enabled: event.target.checked } : entry))}
                  />
                  <span>Enable</span>
                </label>
                <button className="watcher-secondary-button" onClick={() => testAddon(addon)} disabled={testing === addon.id || !addon.manifestUrl}>
                  <Icon name="refresh" size={14} />
                  {testing === addon.id ? 'Testing' : 'Test'}
                </button>
                {!['penguplay', 'showbox', 'hdhub', 'webstreamr', 'flix-free', 'opensubtitles-pro', 'watch-next'].includes(addon.id) ? (
                  <button className="watcher-square-action danger" onClick={() => handleRemove(addon)} aria-label={`Remove ${addon.name}`} title={`Remove ${addon.name}`}>
                    <Icon name="trash" size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="watcher-addon-custom-add">
        <div>
          <span className="watcher-kicker">CUSTOM ADDON</span>
          <h3>Add another manifest</h3>
        </div>
        <div className="watcher-addon-custom-form">
          <input value={newUrl} onChange={(event) => setNewUrl(event.target.value)} placeholder="https://example.com/manifest.json" />
          <button className="watcher-primary-button" onClick={addCustom} disabled={testing === 'custom'}>
            <Icon name="plus" size={15} /> Add Addon
          </button>
        </div>
      </div>

      <div className="watcher-addon-security-note">
        Personal manifest URLs can contain account/configuration data. Watcher stores them in this browser; never publish your private manifest URL in public source code.
      </div>
    </section>
  )
}
