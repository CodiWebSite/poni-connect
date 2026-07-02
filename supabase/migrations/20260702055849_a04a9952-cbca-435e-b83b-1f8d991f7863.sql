
CREATE POLICY "social_media_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'social-media');

CREATE POLICY "social_media_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'social-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "social_media_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'social-media' AND owner = auth.uid());
