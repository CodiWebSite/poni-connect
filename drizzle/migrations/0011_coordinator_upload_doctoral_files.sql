CREATE POLICY "Coordinators upload doctoral files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'doctoral-documents'
  AND EXISTS (
    SELECT 1 FROM public.doctoral_profiles p
    WHERE (storage.foldername(objects.name))[1] = p.id::text
      AND (p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))
  )
);