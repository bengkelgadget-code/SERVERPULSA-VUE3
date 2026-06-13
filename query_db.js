import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
supabase.from('pg_policies').select('*').eq('tablename', 'transactions').then(res => console.log(JSON.stringify(res.data, null, 2)))
