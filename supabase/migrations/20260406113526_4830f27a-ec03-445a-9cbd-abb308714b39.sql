-- Fix security definer views by recreating with security invoker

-- Drop and recreate profiles_chat_safe as SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_chat_safe;
CREATE VIEW public.profiles_chat_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, full_name, department, position, avatar_url, created_at, updated_at
FROM public.profiles;

-- Drop and recreate public_profiles_safe as SECURITY INVOKER  
DROP VIEW IF EXISTS public.public_profiles_safe;
CREATE VIEW public.public_profiles_safe
WITH (security_invoker = true)
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

-- Drop the unused function
DROP FUNCTION IF EXISTS public.get_profiles_for_chat();