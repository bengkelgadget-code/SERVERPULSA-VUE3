const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRPCs() {
  const { data, error } = await supabase.rpc('query_sql', {
    query: `
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname IN ('process_purchase', 'fail_and_refund', 'process_transaction')
    `
  }).catch(() => ({ data: null, error: 'RPC query_sql not found' }));

  if (error || !data) {
    // Let's use direct REST approach if query_sql doesn't exist
    // Or we can just read from information_schema.routines
    const { data: r1 } = await supabase.from('information_schema.routines')
      .select('routine_name, routine_definition')
      .in('routine_name', ['process_purchase', 'fail_and_refund', 'process_transaction'])
      .eq('routine_schema', 'public');
      
    console.log(JSON.stringify(r1, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkRPCs();
