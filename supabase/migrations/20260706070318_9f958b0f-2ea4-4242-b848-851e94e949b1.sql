
DROP POLICY IF EXISTS "community_avatars_read" ON storage.objects;
CREATE POLICY "community_avatars_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'community-avatars');

DROP POLICY IF EXISTS "community_avatars_write" ON storage.objects;
CREATE POLICY "community_avatars_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-avatars'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.community_members m
        WHERE m.user_id = auth.uid()
          AND m.role = 'admin'
          AND (storage.foldername(name))[1] = m.community_id::text
      )
    )
  );

DROP POLICY IF EXISTS "community_avatars_update" ON storage.objects;
CREATE POLICY "community_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'community-avatars'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.community_members m
        WHERE m.user_id = auth.uid()
          AND m.role = 'admin'
          AND (storage.foldername(name))[1] = m.community_id::text
      )
    )
  );

DROP POLICY IF EXISTS "community_avatars_delete" ON storage.objects;
CREATE POLICY "community_avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-avatars'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.community_members m
        WHERE m.user_id = auth.uid()
          AND m.role = 'admin'
          AND (storage.foldername(name))[1] = m.community_id::text
      )
    )
  );
