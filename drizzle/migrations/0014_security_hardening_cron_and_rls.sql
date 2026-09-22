-- 1. Tabel intern pentru tokenuri de cron (fără politici: doar service_role are acces)
CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_secrets TO service_role;
ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;

-- 2. app_settings: anonimii văd doar cheile publice folosite de Kiosk / mentenanță
DROP POLICY IF EXISTS "Anon can read app_settings" ON public.app_settings;
CREATE POLICY "Anon can read public app_settings"
ON public.app_settings
FOR SELECT
TO anon
USING (key IN (
  'maintenance_mode',
  'maintenance_message',
  'maintenance_until',
  'kiosk_enabled',
  'kiosk_message',
  'kiosk_ticker_messages',
  'kiosk_music_enabled',
  'kiosk_music_source',
  'kiosk_music_url',
  'kiosk_music_volume'
));

-- 3. doctoral_coordinators: publicul (pagina de înregistrare) nu mai vede emailurile
REVOKE SELECT ON public.doctoral_coordinators FROM anon;
GRANT SELECT (id, user_id, full_name, academic_title, research_field, is_active)
  ON public.doctoral_coordinators TO anon;

-- 4. room_bookings: Kiosk public nu mai vede descrierile interne
REVOKE SELECT ON public.room_bookings FROM anon;
GRANT SELECT (id, room, title, start_time, end_time, status, created_at)
  ON public.room_bookings TO anon;