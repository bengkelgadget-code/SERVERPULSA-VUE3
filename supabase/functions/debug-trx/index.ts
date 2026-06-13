import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  const { data, error } = await supabase.from('transactions').select('id, user_id, staff_id, sku_code, status, created_at').order('created_at', { ascending: false })
  
  const { data: users } = await supabase.from('users').select('id, role, admin_id')

  return new Response(JSON.stringify({ transactions: data, users, error }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
