
INSERT INTO storage.buckets (id, name, public)
VALUES ('kiosk-music', 'kiosk-music', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read kiosk-music"
ON storage.objects FOR SELECT
USING (bucket_id = 'kiosk-music');

CREATE POLICY "Super admin upload kiosk-music"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kiosk-music' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin update kiosk-music"
ON storage.objects FOR UPDATE
USING (bucket_id = 'kiosk-music' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin delete kiosk-music"
ON storage.objects FOR DELETE
USING (bucket_id = 'kiosk-music' AND public.has_role(auth.uid(), 'super_admin'::app_role));
