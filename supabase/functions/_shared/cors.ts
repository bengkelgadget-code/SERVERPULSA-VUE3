export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature, x-digiflazz-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

export function handleCors(req: Request) {
  const origin = req.headers.get('origin') || '*';
  // If we have specific allowed origins, we could check them here.
  // For now, reflecting the origin is slightly better than '*' if credentials are used, but we'll use '*' unless specified.
  
  const headers = new Headers(corsHeaders);
  if (origin !== '*') {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }
  return null;
}
