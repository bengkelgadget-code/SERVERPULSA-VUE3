import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import md5 from 'md5';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    // Wajib menggunakan SERVICE_ROLE_KEY di backend untuk menembus RLS (Row Level Security)
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT;
    const proxyUser = process.env.PROXY_USER;
    const proxyPass = process.env.PROXY_PASS;

    const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
    const proxyAgent = new HttpsProxyAgent(proxyUrl);

    const username = process.env.DIGIFLAZZ_USERNAME;
    const apiKey = process.env.DIGIFLAZZ_API_KEY;
    const sign = md5(`${username}${apiKey}pricelist`);

    console.log('Requesting price list from Digiflazz via proxy...');
    const response = await axios.post(
      'https://api.digiflazz.com/v1/price-list',
      {
        cmd: 'prepaid',
        username: username,
        sign: sign
      },{ httpsAgent: proxyAgent }
    );

    const digiflazzData = response.data.data;
    
    // Check for Digiflazz API Error like rate limits (RC 83)
    if (digiflazzData && digiflazzData.rc && digiflazzData.rc !== '00') {
        throw new Error(`DigiFlazz Error [${digiflazzData.rc}]: ${digiflazzData.message || 'Unknown Error'}`);
    }

    if (!digiflazzData || !Array.isArray(digiflazzData)) {
      throw new Error(`Invalid response dari DigiFlazz: ${JSON.stringify(response.data)}`);
    }

    const digiflazzProducts = digiflazzData;
    console.log(`Fetched ${digiflazzProducts.length} products from DigiFlazz.`);

    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('sku_code, harga_jual, is_active');
    
    if (fetchError) throw fetchError;

    const existingMap = new Map();
    if (existingProducts) {
      existingProducts.forEach(p => {
        existingMap.set(p.sku_code, p);
      });
    }

    const upsertData = digiflazzProducts.map(p => {
      const existing = existingMap.get(p.buyer_sku_code);
      return {
        sku_code: p.buyer_sku_code,
        product_name: p.product_name,
        category: p.category,
        brand: p.brand,
        type: p.type,
        seller_name: p.seller_name,
        desc: p.desc,
        buyer_sku_status: p.buyer_product_status,
        seller_product_status: p.seller_product_status,
        unlimited_stock: p.unlimited_stock,
        stock: p.stock,
        multi: p.multi,
        start_cut_off: p.start_cut_off,
        end_cut_off: p.end_cut_off,
        harga_modal: p.price,
        harga_jual: existing && existing.harga_jual !== undefined ? existing.harga_jual : p.price,
        // Product is ONLY active if BOTH buyer and seller status are true
        is_active: p.buyer_product_status && p.seller_product_status,
      };
    });

    const chunkSize = 500;
    for (let i = 0; i < upsertData.length; i += chunkSize) {
      const chunk = upsertData.slice(i, i + chunkSize);
      const { error: upsertError } = await supabase
        .from('products')
        .upsert(chunk, { onConflict: 'sku_code' });
      
      if (upsertError) throw upsertError;
    }

    // Handle stale products (products that are in our DB but no longer exist in Digiflazz)
    const digiflazzProductSkus = new Set(digiflazzProducts.map(p => p.buyer_sku_code));
    const staleProductSkus = existingProducts
      .filter(p => !digiflazzProductSkus.has(p.sku_code) && p.is_active === true)
      .map(p => p.sku_code);

    if (staleProductSkus.length > 0) {
      console.log(`Deactivating ${staleProductSkus.length} stale products...`);
      for (let i = 0; i < staleProductSkus.length; i += chunkSize) {
        const chunk = staleProductSkus.slice(i, i + chunkSize);
        const { error: updateError } = await supabase
          .from('products')
          .update({ is_active: false })
          .in('sku_code', chunk);
        
        if (updateError) console.error('Error deactivating stale products:', updateError);
      }
    }

    return res.status(200).json({ success: true, message: `Berhasil sinkronisasi ${upsertData.length} produk!` });
  } catch (error) {
    console.error('Error syncing with DigiFlazz:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
