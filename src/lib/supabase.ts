import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!isSupabaseConfigured) {
  console.error(
    '❌ CRITICAL: Konfigurasi Supabase belum lengkap. VITE_SUPABASE_URL dan/atau VITE_SUPABASE_ANON_KEY kosong.'
  )
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
