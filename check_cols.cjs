const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCols() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  console.log("Columns:", Object.keys(data?.[0] || {}));
}

checkCols();
