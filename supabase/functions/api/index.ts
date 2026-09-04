import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { digiflazz } from '../_shared/digiflazz.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const app = new Hono().basePath('/api')

app.use('*', async (c, next) => {
  const origin = c.req.header('origin')
  const headers = corsHeaders(origin)
  
  if (c.req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }
  
  await next()
  Object.entries(headers).forEach(([k, v]) => {
    c.res.headers.set(k, v)
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

app.get('/proxy-health', async (c) => {
  try {
    // A simple health check to Digiflazz using proxy
    // If it succeeds, the proxy and Digiflazz API are reachable.
    await digiflazz.getBalance();
    return c.json({ status: 'healthy', message: 'Proxy is working correctly' });
  } catch (error: any) {
    return c.json({ 
      status: 'down', 
      message: error.message || 'Proxy is down or unreachable' 
    }, 500);
  }
})

app.get('/admin/digiflazz-balance', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()
  
  const supabase = getSupabase(c)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (!user) {
    console.error('Auth error:', authError)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin' && profile?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const balance = await digiflazz.getBalance()
    return c.json({ success: true, balance })
  } catch (error: any) {
    console.error('Balance error:', error)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})



app.get('/admin/fix-pulsa', async (c) => {
  const supabase = getSupabaseService();
  try {
    const { data, error } = await supabase.from('products').select('sku_code, product_name, harga_jual, harga_modal').eq('category', 'Pulsa');
    if (error) throw error;
    
    let updatedCount = 0;
    const updates = [];
    
    const { data: pulsaProducts } = await supabase.from('products').select('sku_code').eq('category', 'Pulsa');
    const skus = pulsaProducts ? pulsaProducts.map((p: any) => p.sku_code) : [];
    
    let deletedCount = 0;
    if (skus.length > 0) {
      // Chunk delete
      const chunkSize = 100;
      for (let i = 0; i < skus.length; i += chunkSize) {
        const chunk = skus.slice(i, i + chunkSize);
        const { data, error: delErr } = await supabase.from('mitra_pricing').delete().in('product_sku', chunk);
        if (delErr) {
          console.error(delErr);
        } else {
          deletedCount += chunk.length;
        }
      }
    }
    
    return c.json({ success: true, deletedCount });
  } catch (error: any) {
    return c.json({ success: false, error: error.message });
  }
});

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

function isValidCustomerName(n: any): boolean {
  if (typeof n !== 'string') return false;
  const str = n.trim();
  if (str === '' || str === '-') return false;
  // Must contain at least one alphabet character (a-z)
  if (!/[a-zA-Z]/i.test(str)) return false;
  // Ignore internal reference codes or transaction IDs
  if (/^(INQ|CEK|REF|TRX|ORD|INV|PAY|DEV|APP)[A-Z0-9\-_]+$/i.test(str)) return false;
  return true;
}

function selectBestName(candidates: (string | null | undefined)[]): string | null {
  const valid = candidates
    .filter(isValidCustomerName)
    .map(n => String(n).trim());

  if (valid.length === 0) return null;

  // First, prefer any candidate that doesn't contain an asterisk '*'
  const uncensored = valid.find(n => !n.includes('*'));
  if (uncensored) return uncensored;

  // If all candidates contain asterisks, pick the one with the fewest asterisks or longest length
  return valid.reduce((best, curr) => {
    const bestAsterisks = (best.match(/\*/g) || []).length;
    const currAsterisks = (curr.match(/\*/g) || []).length;
    if (currAsterisks < bestAsterisks) return curr;
    if (currAsterisks === bestAsterisks && curr.length > best.length) return curr;
    return best;
  }, valid[0]);
}

function findAllNameCandidates(obj: any, candidates: string[] = [], depth = 0): string[] {
  if (!obj || typeof obj !== 'object' || depth > 5) return candidates;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && isValidCustomerName(value)) {
      const k = key.toLowerCase();
      // Exclude obvious non-name keys
      if (
        k.includes('_no') || k.includes('no_') || k.includes('number') || 
        k.includes('_id') || k.includes('id_') || k === 'id' || k.includes('code') || 
        k.includes('kode') || k.includes('ref') || k.includes('sku') || k.includes('price') || 
        k.includes('amount') || k.includes('total') || k.includes('admin') || k.includes('username') || 
        k.includes('product') || k.includes('brand') || k.includes('category') || k.includes('cmd')
      ) {
        continue;
      }
      if (
        k.includes('nama') || 
        k.includes('name') || 
        k.includes('pemilik') || 
        k.includes('pelanggan') || 
        k.includes('buyer') || 
        k.includes('customer') || 
        k.includes('account') || 
        k.includes('client') ||
        k === 'namapel' ||
        k === 'owner'
      ) {
        if (!candidates.includes(value.trim())) {
          candidates.push(value.trim());
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      findAllNameCandidates(value, candidates, depth + 1);
    }
  }
  return candidates;
}

function extractNameFromDigiflazz(data: any, customName?: string | null): string | null {
  const candidates: string[] = [];
  if (customName) candidates.push(customName);
  if (!data) return selectBestName(candidates);
  
  findAllNameCandidates(data, candidates);

  let snName: string | null = null;
  if (typeof data.sn === 'string') {
    const snMatch = data.sn.match(/(?:NAMA\s*PELANGGAN|NAMA\s*PEMILIK|NAMA\s*AKUN|NAMA|PELANGGAN|PEMILIK)\s*[:=]\s*([^/,|\\]+)/i);
    if (snMatch && snMatch[1]) snName = snMatch[1].trim();
    if (data.sn.includes('A/N ')) {
      const anName = data.sn.split(' | SN: ')[0].replace('A/N ', '').trim();
      if (!anName.includes('*')) snName = anName;
    }
  }
  if (snName) candidates.push(snName);

  return selectBestName(candidates);
}

function enhanceDigiflazzSn(existingSn: string | null, newData: any, customName?: string): string | null {
  let sn = newData.sn || existingSn || null;
  if (!sn) return null;

  let existingAn: string | null = null;
  if (existingSn && existingSn.includes('A/N ')) {
    existingAn = existingSn.split(' | SN: ')[0].replace('A/N ', '').trim();
  }

  const bestName = extractNameFromDigiflazz(newData, customName || existingAn);
  const namePart = bestName ? `A/N ${bestName}` : null;

  let baseSn = sn;
  if (baseSn && baseSn.includes(' | SN: ')) {
    baseSn = baseSn.split(' | SN: ')[1];
  }

  // Append billing details from desc if present and not already in SN
  if (newData.desc && typeof newData.desc === 'object') {
    const desc = newData.desc;
    const detail = Array.isArray(desc.detail) && desc.detail.length > 0 ? desc.detail[0] : (desc.detail || {});
    
    const trf = desc.tarif || detail.tarif || '';
    const daya = desc.daya || detail.daya || '';
    const trfDaya = trf + (daya ? (trf ? `/${daya}` : `${daya}`) : '');
    const periode = desc.periode || detail.periode || detail.period || detail.bln_thn || '';
    
    let stdMtr = desc.meter_reading || detail.meter_reading || detail.stand_meter || detail.std_mtr || '';
    if (!stdMtr) {
      const awal = desc.stand_meter_awal || detail.stand_meter_awal || desc.meter_awal || detail.meter_awal || '';
      const akhir = desc.stand_meter_akhir || detail.stand_meter_akhir || desc.meter_akhir || detail.meter_akhir || '';
      if (awal || akhir) {
        stdMtr = `${awal}-${akhir}`.replace(/^-|-$/g, '');
      }
    }

    const extras: string[] = [];
    if (trfDaya && !baseSn.includes('TRF/DAYA:')) extras.push(`TRF/DAYA: ${trfDaya}`);
    if (periode && !baseSn.includes('BL/TH:')) extras.push(`BL/TH: ${periode}`);
    if (stdMtr && !baseSn.includes('STD MTR:')) extras.push(`STD MTR: ${stdMtr}`);

    if (extras.length > 0) {
      baseSn = `${baseSn} / ${extras.join(' / ')}`;
    }
  }

  return namePart ? `${namePart} | SN: ${baseSn}` : baseSn;
}

app.post('/webhook/digiflazz', handleDigiflazzWebhook)
app.post('/digiflazz-webhook', handleDigiflazzWebhook)

async function handleDigiflazzWebhook(c: any) {
  try {
    const rawBody = await c.req.text();
    const signature = c.req.header('x-hub-signature') || c.req.header('x-digiflazz-signature');
    
    // Log immediately before any checks so we don't lose the payload
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )
    
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch(e) {}
    
    const { data: logRecord } = await supabase.from('webhook_logs').insert({
      ref_id: body.data?.ref_id || null,
      event_type: body.data?.ref_id ? 'transaction' : (body.data?.balance !== undefined ? 'deposit' : 'unknown'),
      payload: body,
      signature: signature,
      processed: false
    }).select('id').maybeSingle();
    const logId = logRecord?.id;

    const updateLog = async (processed: boolean, errorMessage?: string) => {
      if (logId) {
        await supabase.from('webhook_logs').update({
          processed,
          error_message: errorMessage || null
        }).eq('id', logId);
      }
    };

    const secret = Deno.env.get('DIGIFLAZZ_WEBHOOK_SECRET');

    if (!secret) {
      await updateLog(false, 'Webhook not configured (missing secret)');
      return c.json({ error: 'Webhook not configured (missing secret)' }, 500);
    }
    if (!signature) {
      await updateLog(false, 'Missing signature header');
      return c.json({ error: 'Missing signature header' }, 401);
    }
    
    const isValid = await verifyDigiflazzSignature(rawBody, signature, secret);
    if (!isValid) {
      await updateLog(false, 'Invalid signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const { data } = body
    if (!data) {
      await updateLog(false, 'Invalid payload');
      return c.json({ error: 'Invalid payload' }, 400);
    }

    // Handle Deposit Webhook or Broadcast any balance update
    if (data.balance !== undefined) {
      const channel = supabase.channel('superadmin-dashboard-changes')
      await channel.send({
        type: 'broadcast',
        event: 'digiflazz_update',
        payload: { balance: data.balance }
      })
      
      // If it's pure deposit webhook with no ref_id, return success
      if (!data.ref_id) {
        await updateLog(true);
        return c.json({ success: true, message: 'Deposit recorded' })
      }
    }

    if (!data.ref_id) {
      await updateLog(false, 'Missing ref_id');
      return c.json({ error: 'Missing ref_id' }, 400);
    }

    // Check if transaction exists and is pending (also check is_refunded)
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('id, status, sn, customer_name')
      .eq('ref_id', data.ref_id)
      .single()

    if (txError || !tx) {
      await updateLog(false, 'Transaction not found in DB');
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const finalSn = enhanceDigiflazzSn(tx.sn, data, tx.customer_name);
    const bestName = extractNameFromDigiflazz(data, tx.customer_name);

    if (data.status.toLowerCase() === 'gagal') {
      const { error } = await supabase.rpc('fail_and_refund', { 
        p_transaction_id: tx.id,
        p_sn: finalSn,
        p_note: data.message || 'Webhook failed'
      })
      if (error) {
        console.error('Webhook fail_and_refund error:', error);
        await supabase.from('transactions').update({ status: 'gagal', sn: finalSn, note: data.message, updated_at: new Date().toISOString() }).eq('id', tx.id);
        await updateLog(false, 'Database update failed (fail_and_refund fallback used)');
        return c.json({ error: 'Database update failed, fallback used' }, 500);
      }
    } else {
      const updatePayload: any = {
        status: data.status.toLowerCase(),
        sn: finalSn
      };
      if (bestName && !bestName.includes('*')) {
        updatePayload.customer_name = bestName;
      }
      const { error } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', tx.id)
      if (error) {
        await updateLog(false, 'Database update failed (transactions update)');
        return c.json({ error: 'Database update failed' }, 500);
      }
    }
    
    await updateLog(true);
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

function generateRefId() {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `MOB-${Date.now()}-${hex}`;
}

app.post('/debug-pln', async (c) => {
  const body = await c.req.json()
  const { customer_no } = body
  const cleanCustomerNo = String(customer_no).replace(/[^0-9]/g, '').slice(0, 20);
  const ref_id = `INQPLN-${Date.now()}`;
  const result = await digiflazz.createTransaction('pln-subscribe', cleanCustomerNo, ref_id)
  return c.json({ result })
})

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

  const cleanCustomerNo = String(customer_no).replace(/[^0-9]/g, '').slice(0, 20);
  if (!cleanCustomerNo || cleanCustomerNo.length < 4) {
    return c.json({ error: 'Invalid customer number' }, 400)
  }

  const result = await digiflazz.inquiryPln(cleanCustomerNo)
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

  const cleanCustomerNo = String(customer_no).replace(/[^0-9]/g, '').slice(0, 20);
  if (!cleanCustomerNo || cleanCustomerNo.length < 4) {
    return c.json({ error: 'Invalid customer number' }, 400)
  }

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
    let response = await digiflazz.createTransaction(buyerSkuCode, cleanCustomerNo, refId);
    let attempt = 0;
    while (response && response.rc === '03' && attempt < 4) {
      await new Promise(r => setTimeout(r, 2500));
      response = await digiflazz.createTransaction(buyerSkuCode, cleanCustomerNo, refId); // same refId to poll status
      attempt++;
    }

    if (response && response.rc && response.rc !== '00' && response.rc !== '03') {
      return c.json({ success: false, message: response.message || 'Gagal mengecek nama e-wallet', rc: response.rc }, 400);
    }

    // Deduct inquiry fee and create transaction record if there is a price
    if (response && response.price > 0) {
      const supabaseService = getSupabaseService()
      
      const { data: transactionId, error: rpcError } = await supabaseService.rpc('process_purchase', {
        p_user_id: user.id,
        p_sku_code: buyerSkuCode,
        p_customer_no: cleanCustomerNo,
        p_ref_id: refId,
        p_harga_modal: response.price,
        p_harga_jual: response.price,
        p_product_name: `Cek Nama ${provider.toUpperCase()}`
      })

      if (rpcError) {
        return c.json({ success: false, message: 'Saldo tidak cukup untuk pengecekan' }, 400);
      }

      await supabaseService.from('transactions').update({
        status: 'sukses',
        sn: response.sn || response.message || null,
        updated_at: new Date().toISOString()
      }).eq('id', transactionId);
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
    finalName = finalName.trim()
    
    // UPSERT to cache (ewallet_names) if success and name is valid
    if (response.rc === '00' && finalName && !finalName.includes('Menunggu Server')) {
      const supabaseService = getSupabaseService()
      await supabaseService.from('ewallet_names').upsert({
        customer_no: cleanCustomerNo,
        provider: provider.toUpperCase(),
        customer_name: finalName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'customer_no, provider' })
    }

    return c.json({ success: true, name: finalName, rc: response.rc, price: response.price });
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

  if (!customer_no || !sku_code) return c.json({ success: false, error: 'Customer number and sku code required' }, 400)

  const cleanCustomerNo = String(customer_no).replace(/[^0-9]/g, '').slice(0, 20);
  if (!cleanCustomerNo || cleanCustomerNo.length < 4) {
    return c.json({ error: 'Invalid customer number' }, 400)
  }

  const refId = `INQPASCA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    let response = await digiflazz.inquiryPasca(sku_code, cleanCustomerNo, refId);
    
    // Retry loop for RC 03 (pending/processing)
    let attempt = 0;
    while (response && response.rc === '03' && attempt < 4) {
      await new Promise(r => setTimeout(r, 2500));
      response = await digiflazz.inquiryPasca(sku_code, cleanCustomerNo, refId); // same refId to poll status
      attempt++;
    }

    console.log('Digiflazz inquiry-pasca response:', JSON.stringify(response));

    if (!response) {
      return c.json({ success: false, message: 'Tidak ada respons dari server Digiflazz' }, 500);
    }

    // Check for successful inquiry
    if (response.rc === '00' || response.status?.toLowerCase() === 'sukses') {
      let bestName = extractNameFromDigiflazz(response) || response.customer_name || '-';
      
      // Jika nama tersensor (bintang *) dan tagihannya berjenis PLN / listrik, panggil API inquiry-pln untuk mengambil nama asli tanpa sensor
      const isPln = String(sku_code).toLowerCase().includes('pln') || response.desc?.tarif || response.desc?.daya || response.desc?.segment_power;
      if (bestName && bestName.includes('*') && isPln) {
        try {
          const plnInfo = await digiflazz.inquiryPln(cleanCustomerNo);
          if (plnInfo && plnInfo.name && !plnInfo.name.includes('*')) {
            bestName = plnInfo.name.trim();
          }
        } catch (e) {
          console.error('Fallback inquiryPln failed:', e);
        }
      }

      return c.json({ 
        success: true, 
        name: bestName, 
        amount: response.selling_price || response.price || 0,
        admin: response.admin || 0,
        ref_id: refId,
        desc: response.desc
      });
    }

    // Non-success RC codes
    if (response.rc && response.rc !== '03') {
      return c.json({ success: false, message: response.message || 'Gagal mengecek tagihan', rc: response.rc }, 400);
    }

    return c.json({ success: false, message: 'Menunggu Server (Transaksi Pending)', rc: response?.rc });
  } catch (err: any) {
    console.error('inquiry-pasca error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
})

app.post('/sync-digiflazz-balance', async (c) => {
  // Disabled for SaaS architecture. Digiflazz balance is the total asset,
  // while Mitra balance is a virtual liability. They must not be forcibly synced.
  return c.json({ error: 'Fitur sinkronisasi langsung dinonaktifkan dalam mode SAAS. Top-up Anda masuk ke Uang Superadmin, dan saldo Mitra hanya bertambah melalui sistem Deposit.' }, 400);
})

app.post('/check-stale-pending', async (c) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  const CRON_SECRET = Deno.env.get('CRON_SECRET')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  let isCron = false;
  if (token && (token === CRON_SECRET || token === serviceKey)) {
    isCron = true;
  }
  
  if (!isCron) {
    const supabaseService = getSupabaseService()
    const { data: { user } } = await supabaseService.auth.getUser(token || '')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await supabaseService.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'superadmin' && profile?.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  try {
    const supabaseService = getSupabaseService()
    
    // Fetch pending transactions older than 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString()
    const { data: pendingTrx, error: fetchErr } = await supabaseService
      .from('transactions')
      .select('id, ref_id, sku_code, customer_no, status, sn')
      .eq('status', 'pending')
      .lt('created_at', fifteenMinsAgo)
      
    if (fetchErr || !pendingTrx) return c.json({ error: 'Fetch failed' }, 500)
    
    let checkedCount = 0;
    for (const trx of pendingTrx) {
      // Avoid hammering Digiflazz API
      await new Promise(r => setTimeout(r, 500));
      
      const cleanCustomerNo = String(trx.customer_no).replace(/[^0-9]/g, '');
      let response;
      try {
        if (trx.ref_id.startsWith('INQPASCA-')) {
          response = await digiflazz.payPasca(trx.sku_code, cleanCustomerNo, trx.ref_id);
        } else {
          response = await digiflazz.createTransaction(trx.sku_code, cleanCustomerNo, trx.ref_id);
        }
      } catch (err) {
        continue;
      }
      
      const dfStatus = response.status?.toLowerCase() || 'pending';
      if (dfStatus === 'sukses') {
        await supabaseService.from('transactions').update({ 
          status: 'sukses', 
          sn: response.sn || trx.sn || null, 
          updated_at: new Date().toISOString() 
        }).eq('id', trx.id)
      } else if (dfStatus === 'gagal') {
        await supabaseService.rpc('fail_and_refund', { 
          p_transaction_id: trx.id,
          p_sn: response.sn || trx.sn || null,
          p_note: response.message || 'Auto-check failed'
        })
      }
      checkedCount++;
    }
    
    return c.json({ success: true, message: `Checked ${checkedCount} stale transactions` })
  } catch (err: any) {
    console.error('Check stale error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

app.get('/sync-digiflazz', async (c) => {
  try {
    const supabaseService = getSupabaseService();
    const { data, error } = await supabaseService.rpc('get_last_sync_time');
    if (error) throw error;
    
    return c.json({
      status: 'ok',
      last_sync: data || 'Belum ada data sync',
      message: 'Digiflazz sync cron endpoint is active.'
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message }, 500);
  }
})

app.post('/sync-digiflazz', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401)
  const token = authHeader.replace('Bearer ', '').trim()

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const isCron = token === serviceKey || token === Deno.env.get('CRON_SECRET')

  if (!isCron) {
    const supabase = getSupabase(c)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'superadmin' && profile?.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }
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
    
    // Fetch existing products to preserve harga_jual and manual_override
    const { data: existingData } = await supabaseService.from('products').select('sku_code, harga_jual, is_active, manual_override');
    const existingProducts = new Map();
    if (existingData) {
      existingData.forEach(p => existingProducts.set(p.sku_code, p));
    }

    const uniqueProductsMap = new Map();
    for (const item of products) {
      if (!item.buyer_sku_code) continue; // Skip invalid entries

      const existing = existingProducts.get(item.buyer_sku_code);
      const isDigiflazzActive = item.buyer_product_status === true && item.seller_product_status === true;
      const hargaModal = item.price !== undefined ? item.price : (item.admin || 0);
      
      let finalActiveStatus = isDigiflazzActive;
      if (existing) {
        if (existing.manual_override) {
          finalActiveStatus = existing.is_active;
        }
      } else {
        // New item from Digiflazz
        finalActiveStatus = true; // User requested new items to be active
      }

      uniqueProductsMap.set(item.buyer_sku_code, {
        sku_code: item.buyer_sku_code,
        product_name: item.product_name,
        category: item.category,
        brand: item.brand,
        harga_modal: hargaModal,
        harga_jual: existing ? existing.harga_jual : hargaModal,
        is_active: finalActiveStatus
      });
    }

    const productsToUpsert = Array.from(uniqueProductsMap.values());

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

    // Deactivate products that are no longer returned by Digiflazz
    const skusToDeactivate = [];
    existingProducts.forEach((_, sku) => {
      if (sku !== 'SYSTEM_LAST_SYNC' && !uniqueProductsMap.has(sku)) {
        skusToDeactivate.push(sku);
      }
    });

    for (let i = 0; i < skusToDeactivate.length; i += chunkSize) {
      const chunk = skusToDeactivate.slice(i, i + chunkSize);
      await supabaseService.from('products')
        .update({ is_active: false })
        .in('sku_code', chunk);
    }

    // Log the sync time via RPC to avoid constraint errors
    const { error: syncLogError } = await supabaseService.rpc('set_last_sync_time', { p_time: new Date().toISOString() })
    if (syncLogError) console.error('SYSTEM_LAST_SYNC Error (RPC):', syncLogError);

    // Backward compatibility: also upsert to products table for older frontends that haven't received OTA update
    await supabaseService.from('products').upsert({
      sku_code: 'SYSTEM_LAST_SYNC',
      product_name: new Date().toISOString(),
      category: 'System',
      brand: 'System',
      harga_modal: 0,
      harga_jual: 0,
      is_active: false
    }, { onConflict: 'sku_code' })

    if (updatedCount === 0 && lastError) {
       return c.json({ success: false, message: 'Upsert failed: ' + lastError.message, error: lastError }, 500)
    }

    return c.json({ success: true, message: `Synced ${updatedCount} products from Digiflazz` })
  } catch(e) {
    console.error('Sync error:', e)
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

    const cleanCustomerNo = String(customer_no).replace(/[^0-9]/g, '').slice(0, 20);
    if (!cleanCustomerNo || cleanCustomerNo.length < 4) {
      return c.json({ error: 'Invalid customer number' }, 400)
    }

    const { data: product, error: productError } = await supabase
      .from('products').select('harga_modal, harga_jual, is_active, product_name, category').eq('sku_code', sku_code).single()

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
        } else if (product.category === 'Pulsa') {
          // Apply auto default markup for Pulsa
          const match = product.product_name.match(/\d{1,3}(?:\.\d{3})+|\d+/g);
          if (match) {
            let maxNum = 0;
            match.forEach((m: string) => {
              const num = parseInt(m.replace(/\./g, ''));
              if (num >= 1000 && num > maxNum) maxNum = num;
            });
            if (maxNum > 0) {
              const targetJual = maxNum < 100000 ? maxNum + 3000 : maxNum + 5000;
              finalHargaJual = finalHargaModal + Math.max(0, targetJual - finalHargaModal);
            }
          }
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

    const supabaseService = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

    const { data: transactionId, error: rpcError } = await supabaseService.rpc('process_purchase', {
      p_user_id: user.id,
      p_sku_code: sku_code,
      p_customer_no: cleanCustomerNo,
      p_ref_id: refId,
      p_harga_modal: finalHargaModal,
      p_harga_jual: finalHargaJual,
      p_product_name: product.product_name
    })

    if (rpcError) return c.json({ success: false, error: rpcError.message || 'Error' }, 400)

    try {
      let response;
      if (pasca_ref_id) {
        response = await digiflazz.payPasca(sku_code, cleanCustomerNo, refId);
      } else {
        response = await digiflazz.createTransaction(sku_code, cleanCustomerNo, refId);
      }
      
      const dfStatusRaw = (response.status || '').toLowerCase()
      let dbStatus = 'pending'
      if (dfStatusRaw === 'sukses' || dfStatusRaw.includes('sukses')) dbStatus = 'sukses'
      if (dfStatusRaw === 'gagal' || dfStatusRaw.includes('gagal')) dbStatus = 'gagal'

      const finalSn = enhanceDigiflazzSn(null, response, customer_name);
      const bestName = extractNameFromDigiflazz(response, customer_name);

      const updatePayload: any = {
        status: dbStatus,
        sn: finalSn,
        updated_at: new Date().toISOString(),
      };
      if (bestName && !bestName.includes('*')) {
        updatePayload.customer_name = bestName;
      }
      
      if (dbStatus === 'gagal') {
        // Idempotent refund via atomic fail_and_refund RPC
        const { error: refundError } = await supabaseService.rpc('fail_and_refund', { 
          p_transaction_id: transactionId,
          p_sn: finalSn,
          p_note: response.message || 'Digiflazz call failed'
        })
        if (refundError) {
          console.error('Failed to refund transaction:', refundError);
          // Force update status directly as fallback if RPC fails
          await supabaseService.from('transactions').update({ status: 'gagal', note: response.message, updated_at: new Date().toISOString() }).eq('id', transactionId);
        }
        return c.json({ success: false, error: `Transaction failed: ${response.message}`, status: dbStatus, ref_id: refId })
      } else {
        await supabaseService.from('transactions').update(updatePayload).eq('id', transactionId)
      }

      return c.json({ success: true, transactionId, status: dbStatus, ref_id: refId, sn: response.sn, harga_jual: finalHargaJual })
    } catch (digiflazzError: any) {
      console.error('DigiFlazz call failed:', digiflazzError)
      
      const errMsg = digiflazzError.message || '';
      const isTimeout = errMsg.includes('timeout after 30s');
      
      if (!isTimeout) {
        // Jika error bukan karena timeout, kemungkinan besar masalah Proxy / Jaringan.
        // Transaksi tidak pernah sampai ke Digiflazz. Batalkan dan refund otomatis!
        const supabaseService = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
        const { error: refundError } = await supabaseService.rpc('fail_and_refund', { 
          p_transaction_id: transactionId,
          p_note: 'DigiFlazz Network/Proxy Error'
        })
        if (refundError) {
          console.error('Failed to refund transaction on proxy error:', refundError);
          await supabaseService.from('transactions').update({ status: 'gagal', note: 'DigiFlazz Network/Proxy Error', updated_at: new Date().toISOString() }).eq('id', transactionId);
        }
        
        return c.json({ 
          success: false, 
          error: `Gagal diproses: IP Proxy sedang bermasalah / offline. Saldo tidak dipotong. (${errMsg})`, 
          status: 'gagal', 
          ref_id: refId 
        }, 503)
      }

      // DO NOT fail or refund the transaction immediately!
      // If the error was a Timeout (30s), Digiflazz might still be processing it.
      // Leave the transaction as 'pending' in the database.
      // The frontend will show 'Proses' and the Webhook will update it to Sukses/Gagal later.
      return c.json({ 
        success: true, 
        transactionId, 
        status: 'pending', 
        ref_id: refId, 
        message: 'Transaksi sedang diproses di latar belakang' 
      })
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

      if (trx.user_id !== user.id && trx.staff_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Check status in digiflazz
    if (!trx.ref_id) {
      return c.json({ success: true, status: trx.status, message: 'No ref_id, skipped digiflazz check' })
    }

    const cleanCustomerNo = String(trx.customer_no).replace(/[^0-9]/g, '');
    let dfData;
    if (trx.ref_id.startsWith('INQPASCA-')) {
      dfData = await digiflazz.payPasca(trx.sku_code, cleanCustomerNo, trx.ref_id);
    } else {
      dfData = await digiflazz.createTransaction(trx.sku_code, cleanCustomerNo, trx.ref_id);
    }
    const dfStatus = dfData.status?.toLowerCase() || 'pending'
    
    if (dfStatus === 'sukses' && trx.status !== 'sukses') {
      const finalSn = enhanceDigiflazzSn(trx.sn, dfData, trx.customer_name);
      const bestName = extractNameFromDigiflazz(dfData, trx.customer_name);
      const updateData: any = { status: 'sukses', sn: finalSn || null, updated_at: new Date().toISOString() };
      if (bestName && !bestName.includes('*')) {
        updateData.customer_name = bestName;
      }
      const { error: updErr } = await supabaseService.from('transactions').update(updateData).eq('id', trx.id)
      if (updErr) throw new Error(`DB update failed: ${updErr.message}`)
    } else if (dfStatus === 'gagal' && trx.status !== 'gagal') {
      // Atomic refund via fail_and_refund RPC
      const { error: rpcErr } = await supabaseService.rpc('fail_and_refund', { 
        p_transaction_id: trx.id,
        p_sn: dfData.sn || trx.sn || null,
        p_note: dfData.message || 'Manual check status failed'
      })
      if (rpcErr) throw new Error(`Refund rpc failed: ${rpcErr.message}`)
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
  const { data: callerProfile } = await supabase.from('users').select('role, mitra_id').eq('id', user.id).single()
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
      let response;
      if (trx.ref_id.startsWith('INQPASCA-')) {
        response = await digiflazz.payPasca(trx.sku_code, trx.customer_no, trx.ref_id);
      } else {
        response = await digiflazz.createTransaction(trx.sku_code, trx.customer_no, trx.ref_id);
      }
      if (response.status === 'Gagal') {
        const { error: refundError } = await supabaseService.rpc('fail_and_refund', { 
          p_transaction_id: transaction_id,
          p_sn: response.sn || trx.sn || null,
          p_note: response.message || 'Admin manual check status failed'
        })
        if (refundError) {
          console.error('Failed to refund transaction in check-status:', refundError);
          await supabaseService.from('transactions').update({ status: 'gagal', note: response.message, updated_at: new Date().toISOString() }).eq('id', transaction_id);
        }
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
        const { data: targetProfile } = await supabaseService.from('users').select('role, mitra_id').eq('id', payload.id).single()
        if (targetProfile?.role === 'superadmin' || targetProfile?.role === 'admin') {
          return c.json({ error: 'Forbidden' }, 403)
        }
        if (targetProfile?.mitra_id !== callerProfile.mitra_id) {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }

      const updateData: any = {
        email: payload.email
      }
      if (payload.mitra_id !== undefined) {
        updateData.mitra_id = payload.mitra_id
      }
      
      if (payload.password) {
        if (payload.password.length < 8) {
          return c.json({ error: 'Password minimal 8 karakter' }, 400)
        }
        const { error: pwdError } = await supabaseService.auth.admin.updateUserById(payload.id, {
          password: payload.password,
          email: payload.email // Also update auth email just to be safe if email is changed
        })
        if (pwdError) throw pwdError
      } else {
        // If no password provided but email is changed, try to sync email
        const { error: emailError } = await supabaseService.auth.admin.updateUserById(payload.id, {
          email: payload.email
        })
        if (emailError) console.warn('Sync email to auth failed:', emailError)
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
        const { data: targetProfile } = await supabaseService.from('users').select('role, mitra_id').eq('id', payload.id).single()
        if (targetProfile?.role === 'superadmin' || targetProfile?.role === 'admin') {
          return c.json({ error: 'Forbidden' }, 403)
        }
        if (targetProfile?.mitra_id !== callerProfile.mitra_id) {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }
      // Delete auth user (cascades to public.users)
      const { error } = await supabaseService.auth.admin.deleteUser(payload.id)
      if (error) throw error
      return c.json({ success: true })
    }
    
    if (action === 'create_user') {
      if (!payload.password || payload.password.length < 8) {
        return c.json({ error: 'Password minimal 8 karakter' }, 400)
      }

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
      let mitraId = payload.mitra_id;
      if (callerProfile.role === 'admin') {
        // Admins can only create staff for their own mitra
        mitraId = callerProfile.mitra_id;
      }
      
      await supabaseService.from('users').update({
        role: newRole,
        mitra_id: mitraId
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
      const { mitra_id, amount, notes } = payload
      
      if (typeof amount !== 'number' || amount === 0 || amount > 100000000 || amount < -100000000) {
        return c.json({ error: 'Invalid amount' }, 400)
      }
      
      // Ensure only superadmin can add balance directly
      if (callerProfile.role !== 'superadmin') {
        return c.json({ error: 'Forbidden. Only superadmin can add balance directly.' }, 403)
      }
      
      if (!mitra_id) {
        return c.json({ error: 'mitra_id is required' }, 400)
      }

      // Direct balance update using Service Role to avoid needing an admin user
      const { data: mitraData, error: fetchErr } = await supabaseService
        .from('mitras')
        .select('saldo')
        .eq('id', mitra_id)
        .single()
        
      if (fetchErr) throw fetchErr

      const newSaldo = Number(mitraData.saldo || 0) + amount

      const { error: updateErr } = await supabaseService
        .from('mitras')
        .update({ saldo: newSaldo })
        .eq('id', mitra_id)

      if (updateErr) throw updateErr

      // Log the deposit transfer (user_id = superadmin, mitra_id = target)
      const { error: logErr } = await supabaseService
        .from('deposits')
        .insert({
          user_id: user.id, // the superadmin's id
          mitra_id: mitra_id,
          amount: amount,
          status: 'success',
          notes: notes || 'Manual balance adjustment by Superadmin',
          payment_method: 'Superadmin Transfer'
        })
        
      if (logErr) {
        console.error('Failed to log deposit:', logErr)
      }
      
      return c.json({ success: true })
    }

    return c.json({ error: 'Unknown action' }, 400)
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

    const { data: profile } = await supabase.from('users').select('role, mitra_id, saldo').eq('id', user.id).single()
    
    if (profile?.role === 'superadmin') {
      return c.json({ success: true, balance: profile.saldo || 0, saldo: profile.saldo || 0 })
    }

    if (!profile?.mitra_id) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Use service role to bypass RLS and get mitra's balance
    const supabaseService = getSupabaseService()
    const { data: mitraData } = await supabaseService.from('mitras').select('saldo').eq('id', profile.mitra_id).single()
    
    return c.json({ success: true, balance: mitraData?.saldo || 0, saldo: mitraData?.saldo || 0 })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

Deno.serve(app.fetch)
