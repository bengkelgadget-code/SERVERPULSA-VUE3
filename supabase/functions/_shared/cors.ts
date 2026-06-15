const ALLOWED_ORIGINS = [
  'https://serverpulsa-vue-3.vercel.app',
  'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost'
]

export const corsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin || '') ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature, x-digiflazz-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
})

export function handleCors(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const headers = new Headers(corsHeaders(origin));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }
  return null;
}
