
-- Allow anonymous users to read pinned/urgent announcements for Kiosk mode
CREATE POLICY "Anon can view pinned announcements"
ON public.announcements
FOR SELECT
TO anon
USING (is_pinned = true OR priority = 'urgent');

-- Allow anonymous users to read app_settings for maintenance status on Kiosk
CREATE POLICY "Anon can read app_settings"
ON public.app_settings
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read events for Kiosk display
CREATE POLICY "Anon can view upcoming events"
ON public.events
FOR SELECT
TO anon
USING (start_date >= now() - interval '1 day');
