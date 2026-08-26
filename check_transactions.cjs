const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
  // Fetch a single transaction to see actual columns
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.log("Error:", error.message);
  } else if (data && data.length > 0) {
    console.log("Transaction columns:", Object.keys(data[0]).join(', '));
  } else {
    console.log("No transactions found");
  }

  // Check for pending transactions without the note column
  const { data: pending, error: pendingError } = await supabase
    .from('transactions')
    .select('id, ref_id, sku_code, customer_no, status, mitra_id, harga_modal, harga_jual, is_refunded, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log("\n=== PENDING TRANSACTIONS ===");
  if (pendingError) {
    console.log("Error:", pendingError.message);
  } else {
    console.log(`Count: ${pending?.length || 0}`);
    if (pending && pending.length > 0) {
      pending.forEach(t => {
        console.log(`  [${t.created_at}] ref=${t.ref_id} sku=${t.sku_code} customer=${t.customer_no} mitra_id=${t.mitra_id} modal=${t.harga_modal} jual=${t.harga_jual} refunded=${t.is_refunded}`);
      });
    }
  }

  // Check recent gagal transactions and their refund status
  const { data: failed } = await supabase
    .from('transactions')
    .select('id, ref_id, sku_code, status, mitra_id, harga_modal, harga_jual, is_refunded, created_at')
    .eq('status', 'gagal')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log("\n=== RECENT FAILED TRANSACTIONS ===");
  console.log(`Count: ${failed?.length || 0}`);
  if (failed && failed.length > 0) {
    failed.forEach(t => {
      console.log(`  [${t.created_at}] ref=${t.ref_id} mitra_id=${t.mitra_id} modal=${t.harga_modal} jual=${t.harga_jual} refunded=${t.is_refunded}`);
    });
  }
}

checkColumns();
