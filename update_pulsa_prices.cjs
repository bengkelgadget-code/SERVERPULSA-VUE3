const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.from('products').select('sku_code, product_name, category, harga_jual').eq('category', 'Pulsa');
  if (error) {
    console.error(error);
    return;
  }
  
  let updatedCount = 0;
  for (const p of data) {
    let nominal = 0;
    const match = p.product_name.match(/\d{1,3}(?:\.\d{3})+|\d+/g);
    if (match) {
      let maxNum = 0;
      match.forEach(m => {
        const num = parseInt(m.replace(/\./g, ''));
        if (num >= 1000 && num > maxNum) maxNum = num;
      });
      nominal = maxNum;
    }
    
    if (nominal > 0) {
      let targetJual = nominal < 100000 ? nominal + 3000 : nominal + 5000;
      
      // Update if different
      if (p.harga_jual !== targetJual) {
        const { error: updErr } = await sb.from('products').update({ harga_jual: targetJual }).eq('sku_code', p.sku_code);
        if (updErr) {
          console.error(`Failed to update ${p.sku_code}:`, updErr.message);
        } else {
          updatedCount++;
          console.log(`Updated ${p.product_name}: ${p.harga_jual} -> ${targetJual}`);
        }
      }
    }
  }
  console.log(`Successfully updated ${updatedCount} pulsa products.`);
}

run();
