import { isSupabaseConfigured, supabase } from './supabase'

export async function getProfile(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_url, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function updateProfileRecord(userId, payload) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      username: payload.username?.trim().toLowerCase(),
      display_name: payload.displayName?.trim() || '',
      avatar_url: payload.avatarUrl || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('user_id, username, display_name, avatar_url, created_at')
    .single()
  if (error) throw error
  return data
}

export async function searchProfiles(term, limit = 12) {
  if (!supabase) return []
  const clean = term.trim().replace(/[%,_]/g, ' ').replace(/[^a-zA-Z0-9@. -]/g, '').trim()
  if (!clean) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_url, created_at')
    .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
    .order('display_name', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getPublicStats(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase.rpc('get_public_profile_stats', {
    target_user_id: userId,
  })
  if (error) throw error
  return data || null
}

export const communityConfigured = Boolean(isSupabaseConfigured && supabase)
