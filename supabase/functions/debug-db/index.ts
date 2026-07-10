import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )
  const userId = '4308a2d9-95a9-4ab6-aa6a-6e6c0ab7f1ae';
  try {
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )
    const { data: tx1 } = await supabaseService.from('transactions').select('*').eq('ref_id', 'MOB-1783407501226-4672A7BB').single();
    let tx1Fix = null;
    let dbErr = null;
    if (tx1 && tx1.is_refunded === true) {
       // Deduct balance manually
       const { data: user, error: uErr } = await supabaseService.from('users').select('saldo').eq('id', userId).single();
       if (uErr) dbErr = uErr;
       if (user) {
          const { error: updErr } = await supabaseService.from('users').update({ saldo: user.saldo - tx1.harga_jual }).eq('id', userId);
          if (updErr) dbErr = updErr;
          const { error: txUpdErr } = await supabaseService.from('transactions').update({ status: 'sukses', is_refunded: false }).eq('id', tx1.id);
          if (txUpdErr) dbErr = txUpdErr;
          tx1Fix = 'Fixed tx1 successfully';
       }
    }
    
    // Fetch it again to see final state
    const { data: tx1Final } = await supabaseService.from('transactions').select('*').eq('ref_id', 'MOB-1783407501226-4672A7BB').single();
    
    return new Response(JSON.stringify({ tx1Fix, tx1Final, dbErr }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { headers: corsHeaders });
  }
})
