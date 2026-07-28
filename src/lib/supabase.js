import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL  = 'https://qkbpdmeghjuucplbnnsz.supabase.co'
export const SUPABASE_ANON = 'sb_publishable_fCjXonXrWcaS9nmTW5B8Tw_CCNw5ybn'

export const db = createClient(SUPABASE_URL, SUPABASE_ANON)

// Raw REST headers helper — bypasses JS client internals entirely
export async function restHeaders() {
  const { data: { session } } = await db.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON
  return {
    'apikey': SUPABASE_ANON,
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  }
}

export const REST = SUPABASE_URL + '/rest/v1/'
