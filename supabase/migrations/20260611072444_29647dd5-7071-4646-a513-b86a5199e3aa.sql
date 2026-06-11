
-- 1) Convert public_profiles_safe view to SECURITY INVOKER so RLS of caller applies
ALTER VIEW public.public_profiles_safe SET (security_invoker = true);

-- 2) leave_requests: change {public} role policies to {authenticated}
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='leave_requests' AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.leave_requests TO authenticated', r.policyname);
  END LOOP;
END $$;

-- 3) profiles: tighten {public} role policies that were not anonymous-intended
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.profiles TO authenticated', r.policyname);
  END LOOP;
END $$;

-- 4) storage.objects: change {public} role policies on internal buckets to {authenticated}
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND 'public' = ANY(roles)
      AND policyname IN (
        'HR can delete employee documents',
        'HR can update employee documents',
        'HR can view all employee documents',
        'Users can view their own employee documents'
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated', r.policyname);
  END LOOP;
END $$;

-- 5) documents bucket: add UPDATE policy (only original uploader/owner or super_admin)
DROP POLICY IF EXISTS "Only uploader or admin can update documents" ON storage.objects;
CREATE POLICY "Only uploader or admin can update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND (owner = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  bucket_id = 'documents'
  AND (owner = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- 6) archive-documents bucket: tighten INSERT to require uploader-owned path or HR
DROP POLICY IF EXISTS "Authenticated can upload archive docs" ON storage.objects;
DROP POLICY IF EXISTS "Department users can upload archive docs" ON storage.objects;
CREATE POLICY "Department users can upload archive docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'archive-documents'
  AND (
    can_manage_hr(auth.uid())
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);

-- 7) registry-attachments bucket: no end-user access (managed via service role / signed URLs).
DROP POLICY IF EXISTS "Registry attachments no public access" ON storage.objects;
CREATE POLICY "Registry attachments no public access"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'registry-attachments' AND has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (bucket_id = 'registry-attachments' AND has_role(auth.uid(), 'super_admin'::app_role));

-- 8) secretariat-documents bucket: super_admin and secretariat only
DROP POLICY IF EXISTS "Secretariat documents access" ON storage.objects;
CREATE POLICY "Secretariat documents access"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'secretariat-documents'
  AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'secretariat'::app_role))
)
WITH CHECK (
  bucket_id = 'secretariat-documents'
  AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'secretariat'::app_role))
);

-- 9) Revoke EXECUTE from anon on SECURITY DEFINER helpers that should require login
REVOKE EXECUTE ON FUNCTION public.get_meeting_default_recipients() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meeting_default_recipients() TO authenticated;
