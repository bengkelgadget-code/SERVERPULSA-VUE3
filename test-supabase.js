import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://slkdoaeacjxgkviicaot.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Hb_fii3GCvufN1N9Wqs60g_Mkkm_U9W';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  console.log("Testing connection...");
  
  const { data: users, error: errUsers } = await supabase.from('users').select('*').limit(1);
  console.log("Users:", users ? users.length : 0, "Error:", errUsers?.message || 'None');
  
  const { data: products, error: errProd } = await supabase.from('products').select('*').limit(1);
  console.log("Products:", products ? products.length : 0, "Error:", errProd?.message || 'None');
}

testConnection();
