import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
supabase.from('transactions').select('id, user_id, sku_code, customer_no').then(res => console.log(JSON.stringify(res.data, null, 2)))
