-- Aktifkan ekstensi pg_net dan pg_cron jika belum aktif
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus cron job sebelumnya jika ada
SELECT cron.unschedule('sync-digiflazz-daily');

-- Tambahkan cron job baru dengan CRON_SECRET yang baru diset
-- Berjalan setiap 6 jam (jam 00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'sync-digiflazz-daily',
  '0 */6 * * *',
  $$
    SELECT net.http_post(
      url:='https://slkdoaeacjxgkviicaot.supabase.co/functions/v1/api/sync-digiflazz',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ServerPulsaCronSecret2026!'
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=120000
    )
  $$
);
