import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { createWatchlistsRepository } from './lib/watchlistsRepository'
import { updateProfileRecord } from './lib/communityRepository'

const AuthContext = createContext(null)
const LibraryContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session || null)
        setLoading(false)
      }
    }).catch((error) => {
      console.error(error)
      if (active) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null)
      setLoading(false)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    loading,
    configured: isSupabaseConfigured,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not configured.')
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      return result.data
    },
    async signUp(email, password, profile = {}) {
      if (!supabase) throw new Error('Supabase is not configured.')
      const username = profile.username?.trim().replace(/^@+/, '').toLowerCase() || ''
      if (!username || !/^[a-z0-9_]{3,24}$/.test(username)) {
        throw new Error('Username Must Be 3–24 Characters Using Letters, Numbers, Or Underscores.')
      }
      const { data: existingProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('username', username)
        .maybeSingle()
      if (profileLookupError) throw profileLookupError
      if (existingProfile) throw new Error('That Username Is Already Taken.')

      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            display_name: profile.displayName?.trim() || '',
            avatar_url: profile.avatarUrl || '',
            username,
          },
        },
      })
      if (result.error) throw result.error
      return result.data
    },
    async signOut() {
      if (supabase) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
      setSession(null)
    },
    async resetPassword(email) {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      if (error) throw error
    },
    async updatePassword(password) {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { data, error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      return data
    },
    async updateProfile({ displayName, avatarUrl, username }) {
      const cleanUsername = username?.trim().replace(/^@+/, '').toLowerCase() || ''
      if (!supabase) {
        const localProfile = {
          display_name: displayName?.trim() || '',
          avatar_url: avatarUrl || '',
          username: cleanUsername || 'localwatcher',
        }
        localStorage.setItem('watchlist_profile', JSON.stringify(localProfile))
        return { user: { user_metadata: localProfile } }
      }

      if (!cleanUsername || !/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
        throw new Error('Username Must Be 3–24 Characters Using Letters, Numbers, Or Underscores.')
      }

      const { data: existingProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('username', cleanUsername)
        .neq('user_id', session?.user?.id || '')
        .maybeSingle()

      if (profileLookupError) throw profileLookupError
      if (existingProfile) throw new Error('That Username Is Already Taken.')

      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName?.trim() || '',
          avatar_url: avatarUrl || '',
          username: cleanUsername,
        },
      })

      if (error) throw error

      try {
        await updateProfileRecord(data.user.id, {
          username: cleanUsername,
          displayName: displayName?.trim() || '',
          avatarUrl: avatarUrl || '',
        })
      } catch (profileError) {
        if (String(profileError?.message || '').toLowerCase().includes('duplicate')) {
          throw new Error('That Username Is Already Taken.')
        }
        throw profileError
      }

      setSession((current) => (
        current
          ? {
              ...current,
              user: data.user,
            }
          : current
      ))

      return data
    },
  }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function LibraryProvider({ children }) {
  const { user, configured, loading: authLoading } = useAuth()
  const [watchlists, setWatchlists] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const repository = useMemo(() => {
    // In Supabase mode, there is no valid repository until authentication has
    // produced a real user id. Never construct the authenticated repository
    // with an undefined user id, because that would throw during initial render.
    if (isSupabaseConfigured && !user?.id) return null
    return createWatchlistsRepository(user?.id)
  }, [user?.id, configured])

  const reload = async () => {
    if (!repository) return
    setLoading(true)
    setError('')
    try {
      const [lists, allItems] = await Promise.all([repository.list(), repository.listAllItems()])
      setWatchlists(lists)
      setItems(allItems)
    } catch (err) {
      console.error(err)
      setError('Unable to load your watchlists.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return

    // In authenticated/Supabase mode, an unauthenticated visitor should see
    // the login route rather than triggering a database request.
    if (!repository) {
      setWatchlists([])
      setItems([])
      setError('')
      setLoading(false)
      return undefined
    }

    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [lists, allItems] = await Promise.all([repository.list(), repository.listAllItems()])
        if (active) {
          setWatchlists(lists)
          setItems(allItems)
        }
      } catch (err) {
        console.error(err)
        if (active) setError('Unable to load your watchlists.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [authLoading, repository])

  const value = useMemo(() => ({
    watchlists,
    items,
    loading,
    error,
    mode: isSupabaseConfigured ? 'supabase' : 'local',
    async createWatchlist(payload) {
      if (!repository) throw new Error('Please sign in first.')
      const list = await repository.create(payload)
      setWatchlists((current) => [...current, list])
      return list
    },
    async updateWatchlist(id, payload) {
      if (!repository) throw new Error('Please sign in first.')
      const list = await repository.update(id, payload)
      setWatchlists((current) => current.map((entry) => entry.id === id ? list : entry))
      return list
    },
    async deleteWatchlist(id) {
      if (!repository) throw new Error('Please sign in first.')
      await repository.remove(id)
      setWatchlists((current) => current.filter((entry) => entry.id !== id))
      setItems((current) => current.filter((item) => item.watchlist_id !== id))
    },
    async addCatalogItem(watchlistIds, payload) {
      if (!repository) throw new Error('Please sign in first.')
      const ids = [...new Set(watchlistIds)]
      const created = []
      for (const watchlistId of ids) {
        const result = await repository.addItem(watchlistId, payload)
        if (!result.duplicate) created.push(result)
      }
      if (created.length) setItems((current) => [...created, ...current])
      return { created, duplicateCount: ids.length - created.length }
    },
    async updateItem(id, payload) {
      if (!repository) throw new Error('Please sign in first.')
      const updated = await repository.updateItem(id, payload)
      setItems((current) => current.map((item) => item.id === id ? updated : item))
      return updated
    },
    async deleteItem(id) {
      if (!repository) throw new Error('Please sign in first.')
      await repository.removeItem(id)
      setItems((current) => current.filter((item) => item.id !== id))
    },
    async loadWatchlistItems(watchlistId) {
      if (!repository) return []
      return repository.listItems(watchlistId)
    },
    reload,
  }), [watchlists, items, loading, error, repository])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function useLibrary() {
  const value = useContext(LibraryContext)
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider')
  return value
}

// Backward-compatible alias for the existing components while the app is migrated.
export function useWatchlist() {
  const value = useLibrary()
  return {
    items: value.items,
    loading: value.loading,
    error: value.error,
    async addItem(payload) {
      const listId = payload.watchlist_id || value.watchlists[0]?.id
      if (!listId) throw new Error('Create a watchlist first.')
      const result = await value.addCatalogItem([listId], payload)
      return result.created[0]
    },
    updateItem: value.updateItem,
    deleteItem: value.deleteItem,
  }
}
