-- Matikan jadwal cron stale pending yang lama biar nggak bentrok
SELECT cron.unschedule('check-stale-pending-trx');

-- Buat jadwal baru dengan TIMEOUT 120 DETIK dan Service Role Key yang hardcoded
SELECT cron.schedule(
  'check-stale-pending-trx',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url:='https://slkdoaeacjxgkviicaot.supabase.co/functions/v1/api/check-stale-pending',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer GANTI_DENGAN_SERVICE_ROLE_KEY_LU_DISINI'
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=120000
    )
  $$
);
