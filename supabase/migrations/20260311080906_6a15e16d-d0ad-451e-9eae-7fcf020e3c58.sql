
-- Add kiosk slideshow setting
INSERT INTO public.app_settings (key, value) 
VALUES ('kiosk_slideshow_images', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create public storage bucket for kiosk images
INSERT INTO storage.buckets (id, name, public)
VALUES ('kiosk-images', 'kiosk-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to kiosk images
CREATE POLICY "Public read kiosk images" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'kiosk-images');

-- Allow authenticated users to upload/delete kiosk images
CREATE POLICY "Authenticated manage kiosk images" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'kiosk-images')
WITH CHECK (bucket_id = 'kiosk-images');
