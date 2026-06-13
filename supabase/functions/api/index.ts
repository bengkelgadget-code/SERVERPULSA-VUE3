import { Hono } from 'https://deno.land/x/hono@v4.3.11/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { digiflazz } from '../_shared/digiflazz.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const app = new Hono().basePath('/api')

app.use('*', async (c, next) => {
  const corsResponse = c.req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
  if (corsResponse) return corsResponse;
  await next();
  Object.entries(corsHeaders).forEach(([k, v]) => {
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

app.get('/admin/digiflazz-balance', async (c) => {
  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const balance = await digiflazz.getBalance()
    return c.json({ success: true, balance })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.post('/webhook/digiflazz', async (c) => {
  try {
    const body = await c.req.json()
    const { data } = body
    if (!data || !data.ref_id) return c.json({ error: 'Invalid payload' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const { error } = await supabase
      .from('transactions')
      .update({
        status: data.status.toLowerCase(),
        sn: data.sn || null,
        message: data.message || null
      })
      .eq('id', data.ref_id)

    if (error) return c.json({ error: 'Database update failed' }, 500)
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

app.post('/mobile/transaction/purchase', async (c) => {
  const supabase = getSupabase(c)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { data: userData } = await supabase.from('users').select('id, role').eq('id', user.id).single()
  if (!userData?.role || !['staff', 'admin', 'superadmin'].includes(userData.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const body = await c.req.json()
    const { sku_code, customer_no, customer_name } = body

    if (!sku_code || !customer_no) return c.json({ error: 'sku_code and customer_no are required' }, 400)

    const { data: product, error: productError } = await supabase
      .from('products').select('harga_modal, harga_jual, is_active').eq('sku_code', sku_code).single()

    if (productError || !product) return c.json({ error: 'Product not found' }, 404)
    if (!product.is_active) return c.json({ error: 'Product is currently inactive' }, 400)

    const refId = generateRefId()

    const { data: transactionId, error: rpcError } = await supabase.rpc('process_purchase', {
      p_user_id: user.id,
      p_amount: product.harga_jual,
      p_sku_code: sku_code,
      p_customer_no: customer_no,
      p_ref_id: refId,
      p_harga_modal: product.harga_modal,
      p_harga_jual: product.harga_jual,
    })

    if (rpcError) return c.json({ success: false, error: rpcError.message || 'Error' }, 400)

    try {
      const response = await digiflazz.createTransaction(sku_code, customer_no, refId)
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

      return c.json({ success: true, transactionId, status: dbStatus, ref_id: refId, sn: response.sn, harga_jual: product.harga_jual })
    } catch (digiflazzError) {
      console.error('DigiFlazz call failed:', digiflazzError)
      return c.json({ success: true, transactionId, status: 'pending', ref_id: refId, note: 'Waiting for confirmation', harga_jual: product.harga_jual })
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

Deno.serve(app.fetch)
