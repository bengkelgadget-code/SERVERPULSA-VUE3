import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { digiflazz } from '../_shared/digiflazz.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const app = new Hono().basePath('/api')

app.use('*', async (c, next) => {
  const origin = c.req.header('origin') || '*'
  const corsResponse = c.req.method === 'OPTIONS' ? new Response('ok', { 
    headers: { ...corsHeaders, 'Access-Control-Allow-Origin': origin } 
  }) : null;
  
  if (corsResponse) return corsResponse;
  await next();
  Object.entries(corsHeaders).forEach(([k, v]) => {
    c.res.headers.set(k, k === 'Access-Control-Allow-Origin' ? origin : v)
  })
})

const getSupabase = (c: any) => {
  const authHeader = c.req.header('Authorization')
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    {
      global: {
        headers: {
          Authorization: authHeader || '',
        },
      },
    }
  )
}

const getSupabaseService = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )
}

app.get('/admin/digiflazz-balance', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()
  
  const supabase = getSupabase(c)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (!user) {
    return c.json({ error: 'Unauthorized', details: authError }, 401)
  }

  try {
    const balance = await digiflazz.getBalance()
    return c.json({ success: true, balance })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

async function verifyDigiflazzSignature(payload: string, signatureHeader: string, secret: string) {
  if (!signatureHeader || !secret) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign", "verify"]
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return signatureHex === signatureHeader.replace('sha1=', '');
}

app.post('/webhook/digiflazz', async (c) => {
  try {
    const rawBody = await c.req.text();
    const signature = c.req.header('x-hub-signature') || c.req.header('x-digiflazz-signature');
    const secret = Deno.env.get('DIGIFLAZZ_WEBHOOK_SECRET');

    // Only enforce signature check if secret is configured
    if (secret && signature) {
      const isValid = await verifyDigiflazzSignature(rawBody, signature, secret);
      if (!isValid) return c.json({ error: 'Invalid signature' }, 401);
    } else if (secret && !signature) {
      return c.json({ error: 'Missing signature header' }, 401);
    }

    const body = JSON.parse(rawBody);
    const { data } = body
    if (!data || !data.ref_id) return c.json({ error: 'Invalid payload' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Check if transaction exists and is pending
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('status')
      .eq('id', data.ref_id)
      .single()

    if (txError || !tx) return c.json({ error: 'Transaction not found' }, 404)
    if (tx.status !== 'pending') return c.json({ success: true, message: 'Already processed' })

    const { error } = await supabase
      .from('transactions')
      .update({
        status: data.status.toLowerCase(),
        sn: data.sn || null,
        message: data.message || null
      })
      .eq('id', data.ref_id)

    if (error) return c.json({ error: 'Database update failed' }, 500)
    
    // If failed via webhook, trigger refund
    if (data.status.toLowerCase() === 'gagal') {
       await supabase.rpc('refund_purchase', { p_transaction_id: data.ref_id })
    }
    
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

function generateRefId() {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `MOB-${Date.now()}-${hex}`;
}

app.post('/inquiry-pln', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { customer_no } = body

  if (!customer_no) return c.json({ success: false, error: 'Customer number required' }, 400)

  const result = await digiflazz.inquiryPln(customer_no)
  if (result) {
    return c.json({ success: true, name: result.name, segment_power: result.segment_power })
  }
  return c.json({ success: false, message: 'Gagal mengecek nomor PLN' }, 400)
})

app.post('/inquiry-ewallet', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { customer_no, provider, sku_code } = body

  if (!customer_no || !provider) return c.json({ success: false, error: 'Customer number and provider required' }, 400)

  const skuMapping: Record<string, string> = {
    'DANA': 'CEKDANA',
    'OVO': 'CEKOVO',
    'GOPAY': 'CEKGOPAY',
    'SHOPEEPAY': 'CEKSPAY',
    'LINKAJA': 'CEKAJA'
  };

  const buyerSkuCode = sku_code || skuMapping[provider.toUpperCase()] || `CEK${provider.toUpperCase()}`;
  const refId = `CEK${provider.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    let response = await digiflazz.createTransaction(buyerSkuCode, customer_no, refId);
    let attempt = 0;
    while (response && response.rc === '03' && attempt < 4) {
      await new Promise(r => setTimeout(r, 2500));
      response = await digiflazz.createTransaction(buyerSkuCode, customer_no, refId); // same refId to poll status
      attempt++;
    }

    if (response && response.rc && response.rc !== '00' && response.rc !== '03') {
      return c.json({ success: false, message: response.message || 'Gagal mengecek nama e-wallet', rc: response.rc }, 400);
    }

    // Deduct inquiry fee if there is a price
    if (response && response.price > 0) {
      const { data: profile } = await supabase.from('users').select('role, admin_id').eq('id', user.id).single()
      const effectiveUserId = profile?.role === 'staff' ? profile.admin_id : user.id
      
      const supabaseService = getSupabaseService()
      await supabaseService.rpc('add_balance', {
        p_user_id: effectiveUserId,
        p_amount: -response.price
      })
    }

    let rawName = response.sn || response.message || '';
    if (response.rc === '03' && !response.sn) {
      rawName = 'Menunggu Server (Transaksi Pending)';
    }

    let finalName = rawName;
    if (provider.toUpperCase() === 'DANA' && rawName.includes('DANA ')) {
      finalName = rawName.split('DANA ')[1] || rawName;
    } else if (provider.toUpperCase() === 'OVO' && rawName.includes('OVO ')) {
      finalName = rawName.split('OVO ')[1] || rawName;
    } else if (provider.toUpperCase() === 'GOPAY' && rawName.includes('GOPAY ')) {
      finalName = rawName.split('GOPAY ')[1] || rawName;
    } else if (provider.toUpperCase() === 'SHOPEEPAY' && rawName.includes('SPAY ')) {
      finalName = rawName.split('SPAY ')[1] || rawName;
    }

    return c.json({ success: true, name: finalName.trim(), rc: response.rc, price: response.price });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
})

app.post('/inquiry-pasca', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { customer_no, sku_code } = body

  if (!customer_no || !sku_code) return c.json({ success: false, error: 'customer_no and sku_code required' }, 400)

  const refId = `INQ-${sku_code}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    let response = await digiflazz.inquiryPasca(sku_code, customer_no, refId);
    let attempt = 0;
    while (response && response.rc === '03' && attempt < 4) {
      await new Promise(r => setTimeout(r, 2500));
      response = await digiflazz.inquiryPasca(sku_code, customer_no, refId); // same refId to poll status
      attempt++;
    }

    if (response && response.rc && response.rc !== '00' && response.rc !== '03') {
      return c.json({ success: false, message: response.message || 'Gagal mengecek tagihan', rc: response.rc }, 400);
    }

    if (response && response.rc === '00') {
      return c.json({ 
        success: true, 
        name: response.customer_name, 
        amount: response.selling_price || response.price,
        admin: response.admin,
        ref_id: refId, // return the refId to use for pay-pasca
        desc: response.desc
      });
    }

    return c.json({ success: false, message: 'Menunggu Server (Transaksi Pending)', rc: response.rc });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
})

app.post('/sync-digiflazz-balance', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
    const token = authHeader.replace('Bearer ', '').trim()

    const supabase = getSupabase(c)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabase.from('users').select('role, admin_id').eq('id', user.id).single()
    if (profile?.role !== 'superadmin' && profile?.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const digiflazzBalance = await digiflazz.getBalance()
    
    if (typeof digiflazzBalance === 'number') {
      const supabaseService = getSupabaseService()
      const effectiveUserId = profile.role === 'admin' ? user.id : profile.admin_id
      
      await supabaseService.from('users').update({ saldo: digiflazzBalance }).eq('id', effectiveUserId)
      return c.json({ success: true, new_saldo: digiflazzBalance })
    }
    return c.json({ error: 'Failed to fetch digiflazz balance' }, 500)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/sync-digiflazz', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin' && profile?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const prepaidProducts = await digiflazz.getPriceList();
    if (prepaidProducts && !Array.isArray(prepaidProducts) && prepaidProducts.rc) {
      return c.json({ 
        success: false, 
        message: `Digiflazz Error: ${prepaidProducts.message || 'Rate limit tercapai. Coba lagi dalam 15-30 menit.'}` 
      }, 429);
    }
    
    const pascaProducts = await digiflazz.getPascaList();
    if (pascaProducts && !Array.isArray(pascaProducts) && pascaProducts.rc) {
      return c.json({ 
        success: false, 
        message: `Digiflazz Error (Pasca): ${pascaProducts.message || 'Rate limit tercapai. Coba lagi dalam 15-30 menit.'}` 
      }, 429);
    }
    
    let products = [];
    
    // Digiflazz sometimes returns an object with numeric keys instead of an array
    const normalizeToArray = (data: any) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (typeof data === 'object') return Object.values(data);
      return [];
    };

    products = products.concat(normalizeToArray(prepaidProducts));
    products = products.concat(normalizeToArray(pascaProducts));

    if (products.length === 0) {
      return c.json({ success: false, message: 'Invalid response from Digiflazz' }, 500)
    }

    const supabaseService = getSupabaseService();
    
    // Fetch existing products to preserve harga_jual
    const { data: existingData } = await supabaseService.from('products').select('sku_code, harga_jual');
    const existingPrices = new Map();
    if (existingData) {
      existingData.forEach(p => existingPrices.set(p.sku_code, p.harga_jual));
    }

    const productsToUpsert = [];
    for (const item of products) {
      if (item.buyer_product_status === false && item.seller_product_status === false) {
        continue;
      }
      
      const isActive = item.buyer_product_status === true && item.seller_product_status === true;
      const hargaModal = item.price !== undefined ? item.price : (item.admin || 0);
      const existingJual = existingPrices.get(item.buyer_sku_code);

      productsToUpsert.push({
        sku_code: item.buyer_sku_code,
        product_name: item.product_name,
        category: item.category,
        brand: item.brand,
        harga_modal: hargaModal,
        harga_jual: existingJual !== undefined ? existingJual : hargaModal,
        is_active: isActive
      });
    }

    const chunkSize = 500;
    let updatedCount = 0;
    let lastError = null;
    for (let i = 0; i < productsToUpsert.length; i += chunkSize) {
      const chunk = productsToUpsert.slice(i, i + chunkSize);
      const { error } = await supabaseService.from('products').upsert(chunk, { onConflict: 'sku_code' });
      if (!error) {
        updatedCount += chunk.length;
      } else {
        console.error('Bulk upsert error:', error);
        lastError = error;
      }
    }

    if (updatedCount === 0 && lastError) {
       return c.json({ success: false, message: 'Upsert failed: ' + lastError.message, error: lastError }, 500)
    }

    return c.json({ success: true, message: `Synced ${updatedCount} products from Digiflazz` })
  } catch(e) {
    return c.json({ error: 'Internal error' }, 500)
  }
})

app.post('/mobile/transaction/purchase', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { data: userData } = await supabase.from('users').select('id, role').eq('id', user.id).single()
  if (!userData?.role || !['staff', 'admin', 'superadmin'].includes(userData.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const body = await c.req.json()
    const { sku_code, customer_no, customer_name, pasca_ref_id, pasca_amount } = body

    if (!sku_code || !customer_no) return c.json({ error: 'sku_code and customer_no are required' }, 400)

    const { data: product, error: productError } = await supabase
      .from('products').select('harga_modal, harga_jual, is_active').eq('sku_code', sku_code).single()

    if (productError || !product) return c.json({ error: 'Product not found' }, 404)
    if (!product.is_active) return c.json({ error: 'Product is currently inactive' }, 400)

    // Determine pricing based on role
    const { data: profile } = await supabase.from('users').select('role, admin_id').eq('id', user.id).single()
    let finalHargaModal = product.harga_jual // Mitra pays the Superadmin's selling price
    let finalHargaJual = product.harga_jual  // Default selling price

    if (profile?.role === 'admin' || profile?.role === 'staff') {
      const mitraId = profile.role === 'admin' ? user.id : profile.admin_id
      if (mitraId) {
        const { data: mitraPricing } = await supabase
          .from('mitra_pricing')
          .select('markup_amount')
          .eq('mitra_id', mitraId)
          .eq('product_sku', sku_code)
          .single()
        
        if (mitraPricing) {
          finalHargaJual = finalHargaModal + mitraPricing.markup_amount
        }
      }
    } else if (profile?.role === 'superadmin') {
      finalHargaModal = product.harga_modal // Superadmin pays Digiflazz cost directly
    }

    if (pasca_ref_id && pasca_amount !== undefined) {
      finalHargaModal = pasca_amount;
      finalHargaJual = pasca_amount; // You might want to add a fixed markup for pasca here later
    }

    const refId = pasca_ref_id || generateRefId()

    const { data: transactionId, error: rpcError } = await supabase.rpc('process_purchase', {
      p_user_id: user.id,
      p_sku_code: sku_code,
      p_customer_no: customer_no,
      p_ref_id: refId,
      p_harga_modal: finalHargaModal,
      p_harga_jual: finalHargaJual,
    })

    if (rpcError) return c.json({ success: false, error: rpcError.message || 'Error' }, 400)

    try {
      let response;
      if (pasca_ref_id) {
        response = await digiflazz.payPasca(sku_code, customer_no, refId);
      } else {
        response = await digiflazz.createTransaction(sku_code, customer_no, refId);
      }
      
      const dfStatus = response.status.toLowerCase()
      let dbStatus = 'pending'
      if (dfStatus === 'sukses') dbStatus = 'sukses'
      if (dfStatus === 'gagal') dbStatus = 'gagal'

      let finalSn = response.sn || null;
      if (customer_name) {
        finalSn = finalSn ? `A/N ${customer_name} | SN: ${finalSn}` : `A/N ${customer_name}`;
      }

      await supabase.from('transactions').update({
        status: dbStatus,
        sn: finalSn,
        updated_at: new Date().toISOString(),
      }).eq('id', transactionId)

      if (dbStatus === 'gagal') {
        const supabaseService = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
        await supabaseService.rpc('refund_purchase', { p_transaction_id: transactionId })
        return c.json({ success: false, error: `Transaction failed: ${response.message}`, status: dbStatus, ref_id: refId })
      }

      return c.json({ success: true, transactionId, status: dbStatus, ref_id: refId, sn: response.sn, harga_jual: finalHargaJual })
    } catch (digiflazzError) {
      console.error('DigiFlazz call failed:', digiflazzError)
      return c.json({ success: true, transactionId, status: 'pending', ref_id: refId, note: 'Waiting for confirmation', harga_jual: finalHargaJual })
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.post('/mobile/transaction/check-status', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const { transaction_id } = await c.req.json()
    if (!transaction_id) return c.json({ error: 'transaction_id required' }, 400)

    const supabaseService = getSupabaseService()
    const { data: trx } = await supabaseService.from('transactions').select('*').eq('id', transaction_id).single()
    if (!trx) return c.json({ error: 'Transaction not found' }, 404)

    // Check status in digiflazz
    const dfData = await digiflazz.createTransaction(trx.sku_code, trx.customer_no, trx.ref_id)
    const dfStatus = dfData.status?.toLowerCase() || 'pending'
    
    if (dfStatus === 'sukses' && trx.status !== 'sukses') {
      await supabaseService.from('transactions').update({ status: 'sukses', sn: dfData.sn, updated_at: new Date().toISOString() }).eq('id', trx.id)
    } else if (dfStatus === 'gagal' && trx.status !== 'gagal' && !trx.is_refunded) {
      await supabaseService.rpc('refund_purchase', { p_transaction_id: trx.id })
    }

    return c.json({ success: true, status: dfStatus, sn: dfData.sn })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/admin-action', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  // Verify if caller is superadmin or admin
  const { data: callerProfile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'superadmin' && callerProfile?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  try {
    const body = await c.req.json()
    const { action, payload } = body
    if (action === 'check_transaction_status') {
      const { transaction_id } = payload
      
      const { data: trx } = await supabaseService.from('transactions').select('*').eq('id', transaction_id).single()
      if (!trx) return c.json({ error: 'Transaction not found' }, 404)
      
      if (trx.status !== 'pending') {
        return c.json({ success: true, message: 'Transaction is no longer pending', status: trx.status })
      }
      
      // Call Digiflazz
      const response = await digiflazz.createTransaction(trx.sku_code, trx.customer_no, trx.ref_id)
      
      if (response.status === 'Gagal') {
        // Refund via RPC
        await supabaseService.rpc('refund_purchase', { p_transaction_id: transaction_id })
        return c.json({ success: true, status: 'gagal', message: response.message })
      } else if (response.status === 'Sukses') {
        await supabaseService.from('transactions')
          .update({ status: 'sukses', sn: response.sn, note: response.message })
          .eq('id', transaction_id)
        return c.json({ success: true, status: 'sukses', sn: response.sn })
      } else {
        return c.json({ success: true, status: 'pending', message: 'Still pending on Digiflazz' })
      }
    }

    if (action === 'update_user') {
      // Prevent admin from updating superadmin
      if (callerProfile.role === 'admin') {
        const { data: targetProfile } = await supabaseService.from('users').select('role, admin_id').eq('id', payload.id).single()
        if (targetProfile?.role === 'superadmin' || targetProfile?.role === 'admin') {
          return c.json({ error: 'Forbidden' }, 403)
        }
        if (targetProfile?.admin_id !== user.id) {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }

      const updateData: any = {
        nama_toko: payload.nama_toko,
        email: payload.email
      }
      
      // Only superadmins can change roles
      if (payload.role && callerProfile.role === 'superadmin') {
        updateData.role = payload.role
      }
      
      const { error } = await supabaseService.from('users').update(updateData).eq('id', payload.id)
      
      if (error) throw error
      return c.json({ success: true })
    } 
    
    if (action === 'delete_user') {
      if (callerProfile.role === 'admin') {
        const { data: targetProfile } = await supabaseService.from('users').select('role, admin_id').eq('id', payload.id).single()
        if (targetProfile?.role === 'superadmin' || targetProfile?.role === 'admin') {
          return c.json({ error: 'Forbidden' }, 403)
        }
        if (targetProfile?.admin_id !== user.id) {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }
      // Delete auth user (cascades to public.users)
      const { error } = await supabaseService.auth.admin.deleteUser(payload.id)
      if (error) throw error
      return c.json({ success: true })
    }
    
    if (action === 'create_user') {
      // Validate requested role based on caller
      let newRole = payload.role;
      if (callerProfile.role === 'admin') {
        if (newRole && newRole !== 'staff') {
           return c.json({ error: 'Admin can only create staff users' }, 403);
        }
        newRole = 'staff';
      } else {
        newRole = newRole || 'admin';
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true
      })
      if (authError) throw authError
      
      // Update the automatically created profile
      const adminId = callerProfile.role === 'admin' ? user.id : null;
      
      await supabaseService.from('users').update({
        nama_toko: payload.nama_toko,
        role: newRole,
        admin_id: adminId
      }).eq('id', authData.user.id)
      
      return c.json({ success: true, user: authData.user })
    }

    if (action === 'update_product_markup') {
      const { sku, markup } = payload
      
      if (typeof markup !== 'number' || markup < 0) {
        return c.json({ error: 'Markup cannot be negative' }, 400)
      }

      if (callerProfile.role === 'superadmin') {
        const { error } = await supabaseService.from('products').update({ harga_jual: markup }).eq('sku_code', sku)
        if (error) throw error
      } else if (callerProfile.role === 'admin') {
        const { error } = await supabaseService.from('mitra_pricing').upsert({
          mitra_id: user.id,
          product_sku: sku,
          markup_amount: markup,
          updated_at: new Date().toISOString()
        }, { onConflict: 'mitra_id,product_sku' })
        if (error) throw error
      }
      return c.json({ success: true })
    }

    if (action === 'batch_update_product_markup') {
      const { items } = payload // array of { sku, markup }
      
      if (!Array.isArray(items)) {
        return c.json({ error: 'Items must be an array' }, 400)
      }

      if (callerProfile.role === 'superadmin') {
        // Superadmin uses bulk update or multiple updates
        // For simplicity, we can map over items and update
        const promises = items.map(item => {
          if (typeof item.markup !== 'number' || item.markup < 0) return Promise.resolve()
          return supabaseService.from('products').update({ harga_jual: item.markup }).eq('sku_code', item.sku)
        })
        await Promise.all(promises)
      } else if (callerProfile.role === 'admin') {
        const upserts = items
          .filter(item => typeof item.markup === 'number' && item.markup >= 0)
          .map(item => ({
            mitra_id: user.id,
            product_sku: item.sku,
            markup_amount: item.markup,
            updated_at: new Date().toISOString()
          }))
        
        if (upserts.length > 0) {
          const { error } = await supabaseService.from('mitra_pricing').upsert(upserts, { onConflict: 'mitra_id,product_sku' })
          if (error) throw error
        }
      }
      return c.json({ success: true })
    }

    if (action === 'add_balance') {
      const { user_id, amount } = payload
      
      // Ensure only superadmin or admin can add balance
      // Superadmin can add balance to anyone. Admin can add balance to their staff.
      if (callerProfile.role === 'admin') {
        const { data: targetProfile } = await supabaseService.from('users').select('admin_id').eq('id', user_id).single()
        if (targetProfile?.admin_id !== user.id) {
          return c.json({ error: 'Forbidden. You can only add balance to your own staff.' }, 403)
        }
        
        // Admin must have enough balance to transfer
        const { data: adminData } = await supabaseService.from('users').select('saldo').eq('id', user.id).single()
        if (!adminData || adminData.saldo < amount) {
          return c.json({ error: 'Insufficient balance' }, 400)
        }
        
        // Deduct admin balance
        await supabaseService.rpc('add_balance', { p_user_id: user.id, p_amount: -amount })
      }
      
      const { error } = await supabaseService.rpc('add_balance', {
        p_user_id: user_id,
        p_amount: amount
      })
      if (error) throw error
      return c.json({ success: true })
    }

    return c.json({ error: 'Unknown action' }, 400)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Webhook from Digiflazz
app.post('/digiflazz-webhook', async (c) => {
  try {
    const payload = await c.req.json()
    const ref_id = payload?.data?.ref_id

    if (!ref_id) return c.json({ error: 'Missing ref_id' }, 400)

    const supabaseService = getSupabaseService()
    
    // Find transaction
    const { data: trx } = await supabaseService.from('transactions').select('*').eq('ref_id', ref_id).single()
    if (!trx) return c.json({ error: 'Transaction not found' }, 404)

    // Only process if it's currently pending
    if (trx.status === 'pending') {
      // Verify actual status by asking Digiflazz directly to prevent webhook spoofing
      const dfData = await digiflazz.createTransaction(trx.sku_code, trx.customer_no, trx.ref_id)
      const dfStatus = dfData.status?.toLowerCase() || 'pending'
      
      if (dfStatus === 'sukses') {
        await supabaseService.from('transactions').update({ status: 'sukses', sn: dfData.sn, updated_at: new Date().toISOString() }).eq('id', trx.id)
      } else if (dfStatus === 'gagal' && !trx.is_refunded) {
        await supabaseService.rpc('refund_purchase', { p_transaction_id: trx.id })
      }
    }

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/get-admin-balance', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
    const token = authHeader.replace('Bearer ', '').trim()

    const supabase = getSupabase(c)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabase.from('users').select('role, admin_id').eq('id', user.id).single()
    
    if (profile?.role !== 'staff' || !profile?.admin_id) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Use service role to bypass RLS and get admin's balance
    const supabaseService = getSupabaseService()
    const { data: adminData } = await supabaseService.from('users').select('saldo').eq('id', profile.admin_id).single()
    
    return c.json({ success: true, saldo: adminData?.saldo || 0 })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

Deno.serve(app.fetch)
