-- Aktifkan ekstensi pg_net dan pg_cron jika belum aktif
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus cron job sebelumnya jika ada untuk menghindari duplikat dan kegagalan auth
SELECT cron.unschedule('sync-digiflazz-daily');

-- Tambahkan cron job baru dengan Service Role Key statis dan timeout 120 detik
-- Berjalan setiap 6 jam (jam 00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'sync-digiflazz-daily',
  '0 */6 * * *',
  $$
    SELECT net.http_post(
      url:='https://slkdoaeacjxgkviicaot.supabase.co/functions/v1/api/sync-digiflazz',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer GANTI_DENGAN_SERVICE_ROLE_KEY_LU_DISINI'
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=120000
    )
  $$
);
