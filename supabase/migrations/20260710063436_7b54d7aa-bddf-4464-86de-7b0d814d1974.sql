CREATE OR REPLACE FUNCTION public.get_leave_replacement_options(_employee_epd_id uuid)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  job_position text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT epd.id, epd.first_name, epd.last_name, epd.position AS job_position
  FROM public.leave_replacement_overrides lro
  JOIN public.employee_personal_data epd ON epd.id = lro.replacement_epd_id
  WHERE lro.employee_epd_id = _employee_epd_id
    AND COALESCE(epd.is_archived, false) = false
    AND (
      public.can_manage_hr(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.employee_personal_data requester_epd
        JOIN public.employee_records er ON er.id = requester_epd.employee_record_id
        WHERE requester_epd.id = _employee_epd_id
          AND er.user_id = auth.uid()
      )
    )
  ORDER BY epd.last_name, epd.first_name;
$$;

REVOKE ALL ON FUNCTION public.get_leave_replacement_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leave_replacement_options(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leave_replacement_options(uuid) TO service_role;