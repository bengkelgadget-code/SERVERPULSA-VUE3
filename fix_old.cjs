const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'supabase/functions/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixOldTransaction() {
  console.log("Fetching old transactions with ref_id like 'MOB-178435062%'...");
  const { data, error } = await supabase.from('transactions').select('*').ilike('ref_id', 'MOB-178435062%');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("Transaction not found.");
    return;
  }
  
  const tx = data[0];
  console.log("Found transaction:", tx.id, tx.status);
  
  if (tx.status !== 'gagal') {
    console.log("Triggering fail_and_refund...");
    const { error: rpcError } = await supabase.rpc('fail_and_refund', { 
      p_transaction_id: tx.id,
      p_sn: tx.sn,
      p_note: 'Manual fix from AI'
    });
    
    if (rpcError) {
      console.error("RPC Error:", rpcError);
    } else {
      console.log("Successfully refunded old transaction!");
    }
  } else {
    console.log("Transaction is already gagal.");
  }
}
fixOldTransaction();
