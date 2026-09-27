import { useMemo, useState } from 'react'
import {
  fetchAddonManifest,
  getStreamAddons,
  resetStreamAddons,
  saveStreamAddons,
} from '../lib/streamAddons'

const GROUPS = [
  { key: 'stream', title: 'Streaming Sources', description: 'Used automatically when you press Play.' },
  { key: 'subtitles', title: 'Subtitles', description: 'Used automatically alongside playback.' },
  { key: 'next', title: 'Next Watch', description: 'Used for recommendation links.' },
]

export default function AddonSettingsPanel({ notify }) {
  const [addons, setAddons] = useState(() => getStreamAddons())
  const [testingId, setTestingId] = useState('')

  const grouped = useMemo(() => GROUPS.map((group) => ({
    ...group,
    entries: addons.filter((addon) => addon.kind === group.key),
  })), [addons])

  const commit = (next) => {
    const saved = saveStreamAddons(next)
    setAddons(saved)
  }

  const update = (id, patch) => {
    const next = addons.map((addon) => (addon.id === id ? { ...addon, ...patch } : addon))
    commit(next)
  }

  const test = async (addon) => {
    if (!addon.manifestUrl) {
      notify?.(`${addon.name} Needs A Manifest URL.`, 'error')
      return
    }
    setTestingId(addon.id)
    try {
      const manifest = await fetchAddonManifest(addon.manifestUrl, 10000)
      update(addon.id, { name: manifest.name || addon.name })
      notify?.(`${manifest.name || addon.name} Manifest Works.`, 'success')
    } catch (error) {
      notify?.(`${addon.name}: ${error.message}`, 'error')
    } finally {
      setTestingId('')
    }
  }

  const reset = () => {
    const next = resetStreamAddons()
    setAddons(next)
    notify?.('Addon Settings Reset.', 'success')
  }

  return (
    <section className="watcher-addon-settings-card">
      <div className="watcher-addon-settings-heading">
        <div>
          <span className="watcher-kicker">STREAMING & ADDONS</span>
          <h2>Everything In One Place.</h2>
          <p>Paste configured manifest URLs once. Watcher keeps the rest automatic.</p>
        </div>
        <button type="button" className="watcher-secondary-button" onClick={reset}>Reset Addons</button>
      </div>

      {grouped.map((group) => (
        <div className="watcher-addon-group" key={group.key}>
          <div className="watcher-addon-group-heading">
            <div>
              <strong>{group.title}</strong>
              <span>{group.description}</span>
            </div>
            <span>{group.entries.length}</span>
          </div>

          <div className="watcher-addon-list">
            {group.entries.map((addon) => (
              <div className="watcher-addon-row" key={addon.id}>
                <div className="watcher-addon-row-top">
                  <div>
                    <strong>{addon.name}</strong>
                    <span>{addon.description}</span>
                  </div>
                  <label className="watcher-addon-toggle">
                    <input
                      type="checkbox"
                      checked={addon.enabled}
                      onChange={(event) => update(addon.id, { enabled: event.target.checked })}
                    />
                    <span>{addon.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div className="watcher-addon-row-controls">
                  <input
                    value={addon.manifestUrl}
                    onChange={(event) => update(addon.id, { manifestUrl: event.target.value })}
                    placeholder={addon.id === 'penguplay' ? 'Paste your authenticated PenguPlay manifest URL' : 'https://example.com/manifest.json'}
                    spellCheck="false"
                  />
                  <button type="button" className="watcher-secondary-button" onClick={() => test(addon)} disabled={testingId === addon.id}>
                    {testingId === addon.id ? 'Testing…' : 'Test'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
