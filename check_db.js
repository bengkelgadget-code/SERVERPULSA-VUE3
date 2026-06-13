import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { data } = await supabase.from('products').select('sku_code, category, brand, product_name').ilike('category', '%PASCABAYAR%')
  console.log('Pasca Products:', data?.length)
  console.log(data?.slice(0, 5))
}

check()
