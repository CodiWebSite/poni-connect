-- Create a comprehensive employee directory view from employee_personal_data
-- This shows ALL active employees (267), not just those with accounts (111)
-- Only exposes non-sensitive directory info (no CNP, CI, address, etc.)
-- security_invoker=off means it bypasses EPD's RLS (runs as owner)
CREATE OR REPLACE VIEW public.employee_directory_full AS
  SELECT 
    epd.id,
    epd.first_name,
    epd.last_name,
    TRIM(epd.last_name || ' ' || epd.first_name) AS full_name,
    epd.department,
    epd.position,
    epd.email,
    p.avatar_url,
    p.user_id
  FROM public.employee_personal_data epd
  LEFT JOIN public.profiles p ON p.user_id = (
    SELECT er.user_id FROM public.employee_records er WHERE er.id = epd.employee_record_id LIMIT 1
  )
  WHERE epd.is_archived = false
  ORDER BY epd.last_name, epd.first_name;

-- Grant access to authenticated users
GRANT SELECT ON public.employee_directory_full TO authenticated;
