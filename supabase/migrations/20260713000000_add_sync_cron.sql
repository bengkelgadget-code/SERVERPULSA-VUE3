-- Aktifkan ekstensi pg_net dan pg_cron jika belum aktif
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus cron job sebelumnya jika ada untuk menghindari duplikat
SELECT cron.unschedule('sync-digiflazz-daily');

-- Tambahkan cron job untuk memanggil edge function sync-digiflazz
-- Berjalan setiap jam 22:30 UTC (06:30 WITA)
SELECT cron.schedule(
  'sync-digiflazz-daily',
  '30 22 * * *',
  $$
    SELECT net.http_post(
      url:='https://slkdoaeacjxgkviicaot.supabase.co/functions/v1/api/sync-digiflazz',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body:='{}'::jsonb
    )
  $$
);
