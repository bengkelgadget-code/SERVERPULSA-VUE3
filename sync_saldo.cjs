const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSaldo() {
  console.log("=== STARTING FIX ===");
  
  // 1. Get Live Digiflazz Balance using the edge function or direct API
  // We'll call the edge function proxy-health or admin/digiflazz-balance but we don't have token here.
  // Let's directly call Digiflazz API. We need Digiflazz credentials from .env
  
  const dfUsername = process.env.DIGIFLAZZ_USERNAME;
  const dfKey = process.env.DIGIFLAZZ_API_KEY;
  
  if (!dfUsername || !dfKey) {
    console.log("Missing Digiflazz credentials in .env");
    process.exit(1);
  }

  // Generate signature
  const crypto = require('crypto');
  const sign = crypto.createHash('md5').update(dfUsername + dfKey + 'depo').digest('hex');
  
  let digiBalance = 0;
  try {
    const res = await fetch('https://api.digiflazz.com/v1/cek-saldo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'deposit',
        username: dfUsername,
        sign: sign
      })
    });
    const data = await res.json();
    if (data.data && data.data.deposit !== undefined) {
      digiBalance = data.data.deposit;
      console.log(`Live Digiflazz Balance: Rp ${digiBalance}`);
    } else {
      console.log("Failed to fetch Digiflazz balance:", data);
      process.exit(1);
    }
  } catch (e) {
    console.log("Error fetching Digiflazz balance:", e.message);
    process.exit(1);
  }

  // 2. Set Mitra Balance
  const { data: mitras, error: mErr } = await supabase.from('mitras').select('id, nama_mitra, saldo').eq('nama_mitra', 'BENGKEL GADGET');
  if (mErr) {
    console.log("Error fetching mitras:", mErr.message);
  } else if (mitras.length > 0) {
    const mitra = mitras[0];
    console.log(`Current Mitra Balance (${mitra.nama_mitra}): Rp ${mitra.saldo}`);
    
    const { error: updateErr } = await supabase.from('mitras').update({ saldo: digiBalance }).eq('id', mitra.id);
    if (updateErr) {
      console.log("Failed to update mitra saldo:", updateErr.message);
    } else {
      console.log(`✅ Successfully updated Mitra Balance to Rp ${digiBalance}`);
    }
  } else {
    console.log("Mitra BENGKEL GADGET not found.");
  }

  // 3. Verify 'note' column exists in transactions
  const { data: tx, error: txErr } = await supabase.from('transactions').select('*').limit(1);
  if (txErr) {
    console.log("Error fetching transaction:", txErr.message);
  } else if (tx.length > 0) {
    if ('note' in tx[0]) {
      console.log("✅ 'note' column exists in transactions table. RPC fix is active!");
    } else {
      console.log("❌ WARNING: 'note' column is STILL MISSING. The SQL fix was not applied!");
    }
  }
}

fixSaldo();
