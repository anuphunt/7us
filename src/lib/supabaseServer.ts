import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !secretKey) {
  throw new Error('Missing Supabase environment variables for server usage.')
}

export const supabaseServer = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
})
