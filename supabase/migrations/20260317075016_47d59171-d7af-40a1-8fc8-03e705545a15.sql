-- Recreate the employee_directory_full view with security_invoker=false
-- so ALL authenticated users can see the full employee directory
-- (the view only exposes safe columns: name, department, position, avatar)
DROP VIEW IF EXISTS public.employee_directory_full;

CREATE VIEW public.employee_directory_full
WITH (security_invoker=false) AS
SELECT epd.id,
    epd.first_name,
    epd.last_name,
    TRIM(BOTH FROM ((epd.last_name || ' '::text) || epd.first_name)) AS full_name,
    epd.department,
    epd.position,
    epd.email,
    p.avatar_url,
    p.user_id
   FROM employee_personal_data epd
     LEFT JOIN profiles p ON p.user_id = (
       SELECT er.user_id
       FROM employee_records er
       WHERE er.id = epd.employee_record_id
       LIMIT 1
     )
  WHERE epd.is_archived = false
  ORDER BY epd.last_name, epd.first_name;

-- Grant SELECT to authenticated users
GRANT SELECT ON public.employee_directory_full TO authenticated;