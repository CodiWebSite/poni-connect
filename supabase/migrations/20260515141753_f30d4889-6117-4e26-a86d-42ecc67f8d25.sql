
-- 1. Tighten can_manage_content to specific content roles only
CREATE OR REPLACE FUNCTION public.can_manage_content(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','secretariat','compartiment_comunicare','director_institut','director_adjunct','secretar_stiintific')
  )
$$;

-- 2. Chat attachments: restrict SELECT to participants of the conversation
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
CREATE POLICY "Chat participants can view conversation attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.chat_messages cm
    WHERE cm.attachment_url LIKE '%' || storage.objects.name
      AND public.is_chat_participant(auth.uid(), cm.conversation_id)
  )
);

-- 3. Public profile phone masking: revoke anon access to raw table; route anon through SECURITY DEFINER safe view
DROP POLICY IF EXISTS "Anon can view public profiles with masking" ON public.public_profile_settings;
REVOKE SELECT ON public.public_profile_settings FROM anon;

-- Recreate the safe view as SECURITY DEFINER so anon can read masked columns without raw table access
DROP VIEW IF EXISTS public.public_profiles_safe;
CREATE VIEW public.public_profiles_safe
WITH (security_invoker = false)
AS
SELECT
  id, epd_id,
  tagline, tagline_en, bio, bio_en,
  CASE WHEN show_phone THEN phone ELSE NULL END AS phone,
  CASE WHEN show_position THEN position_en ELSE NULL END AS position_en,
  CASE WHEN show_department THEN department_en ELSE NULL END AS department_en,
  linkedin_url, orcid_url, researchgate_url, google_scholar_url,
  x_url, facebook_url, instagram_url, website_url,
  show_phone, show_email, show_department, show_position,
  created_at, updated_at
FROM public.public_profile_settings;

GRANT SELECT ON public.public_profiles_safe TO anon, authenticated;
