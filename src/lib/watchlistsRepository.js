import { isSupabaseConfigured, supabase } from './supabase'

const WATCHLISTS_KEY = 'watchlists_v2'
const ITEMS_KEY = 'watchlist_items_v2'

function createId(prefix = 'local') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function read(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(value) ? value : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

async function localSeed() {
  let lists = read(WATCHLISTS_KEY)
  let items = read(ITEMS_KEY)
  if (!lists.length) {
    const now = new Date().toISOString()
    lists = [{ id: createId('wl'), name: 'My Watchlist', description: 'Your main collection.', created_at: now, updated_at: now }]
    write(WATCHLISTS_KEY, lists)

    // Migrate the first version of the app into the new default watchlist.
    try {
      const old = JSON.parse(localStorage.getItem('watchlist_items') || 'null')
      if (Array.isArray(old) && old.length && !items.length) {
        items = old.map((item) => ({ ...item, watchlist_id: lists[0].id }))
        write(ITEMS_KEY, items)
      }
    } catch {
      // Ignore a corrupt legacy payload.
    }
  }
  return { lists, items }
}

export function createWatchlistsRepository(userId) {
  if (!isSupabaseConfigured) {
    return {
      async list() { return (await localSeed()).lists },
      async create(payload) {
        const { lists } = await localSeed()
        const now = new Date().toISOString()
        const list = { id: createId('wl'), name: payload.name.trim(), description: payload.description?.trim() || null, created_at: now, updated_at: now }
        write(WATCHLISTS_KEY, [list, ...lists])
        return list
      },
      async update(id, payload) {
        const { lists } = await localSeed()
        const current = lists.find((list) => list.id === id)
        if (!current) throw new Error('Watchlist not found.')
        const updated = { ...current, ...payload, updated_at: new Date().toISOString() }
        write(WATCHLISTS_KEY, lists.map((list) => list.id === id ? updated : list))
        return updated
      },
      async remove(id) {
        const { lists, items } = await localSeed()
        if (lists.length <= 1) throw new Error('Keep at least one watchlist.')
        write(WATCHLISTS_KEY, lists.filter((list) => list.id !== id))
        write(ITEMS_KEY, items.filter((item) => item.watchlist_id !== id))
      },
      async listItems(watchlistId) {
        const { items } = await localSeed()
        return items.filter((item) => item.watchlist_id === watchlistId).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      },
      async listAllItems() { return (await localSeed()).items },
      async addItem(watchlistId, payload) {
        const { items } = await localSeed()
        const duplicate = items.find((item) => item.watchlist_id === watchlistId && item.tmdb_id === payload.tmdb_id && item.type === payload.type)
        if (duplicate) return { ...duplicate, duplicate: true }
        const now = new Date().toISOString()
        const item = { ...payload, id: createId('item'), watchlist_id: watchlistId, created_at: now, updated_at: now }
        write(ITEMS_KEY, [item, ...items])
        return item
      },
      async updateItem(id, payload) {
        const { items } = await localSeed()
        const current = items.find((item) => item.id === id)
        if (!current) throw new Error('Title not found.')
        const updated = { ...current, ...payload, updated_at: new Date().toISOString() }
        write(ITEMS_KEY, items.map((item) => item.id === id ? updated : item))
        return updated
      },
      async removeItem(id) {
        const { items } = await localSeed()
        write(ITEMS_KEY, items.filter((item) => item.id !== id))
      },
    }
  }

  if (!userId) throw new Error('A signed-in user is required.')

  return {
    async list() {
      const { data, error } = await supabase.from('watchlists').select('*').eq('user_id', userId).order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
    async create(payload) {
      const { data, error } = await supabase.from('watchlists').insert({ name: payload.name.trim(), description: payload.description?.trim() || null, user_id: userId }).select('*').single()
      if (error) throw error
      return data
    },
    async update(id, payload) {
      const { data, error } = await supabase.from('watchlists').update(payload).eq('id', id).eq('user_id', userId).select('*').single()
      if (error) throw error
      return data
    },
    async remove(id) {
      const { error } = await supabase.from('watchlists').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
    },
    async listItems(watchlistId) {
      const { data, error } = await supabase.from('watchlist_items').select('*').eq('watchlist_id', watchlistId).eq('user_id', userId).order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    async listAllItems() {
      const { data, error } = await supabase.from('watchlist_items').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    async addItem(watchlistId, payload) {
      const row = { ...payload, watchlist_id: watchlistId, user_id: userId }
      const { data, error } = await supabase.from('watchlist_items').insert(row).select('*').single()
      if (error) {
        if (error.code === '23505') {
          return { duplicate: true }
        }
        throw error
      }
      return data
    },
    async updateItem(id, payload) {
      const { data, error } = await supabase.from('watchlist_items').update(payload).eq('id', id).eq('user_id', userId).select('*').single()
      if (error) throw error
      return data
    },
    async removeItem(id) {
      const { error } = await supabase.from('watchlist_items').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
    },
  }
}
