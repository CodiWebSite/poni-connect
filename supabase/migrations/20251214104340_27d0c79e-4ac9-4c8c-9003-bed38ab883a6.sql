-- Fix SECURITY DEFINER view issue
-- Drop and recreate the view with explicit SECURITY INVOKER (safer)
DROP VIEW IF EXISTS public.employee_directory;

CREATE VIEW public.employee_directory 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  full_name,
  department,
  position,
  avatar_url,
  birth_date,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.employee_directory TO authenticated;