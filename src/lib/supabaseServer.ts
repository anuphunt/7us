import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing Supabase environment variables for server usage.')
}

export const supabaseServer = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})
