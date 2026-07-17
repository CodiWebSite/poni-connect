GRANT SELECT, INSERT, UPDATE, DELETE ON public.helpdesk_tickets TO authenticated;
GRANT INSERT ON public.helpdesk_tickets TO anon;
GRANT ALL ON public.helpdesk_tickets TO service_role;

CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON public.helpdesk_tickets (status);

CREATE INDEX IF NOT EXISTS idx_leave_requests_real_created_at_desc
ON public.leave_requests (created_at DESC)
WHERE (is_demo = false OR is_demo IS NULL);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status_created_at_desc
ON public.leave_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_requests_epd_id
ON public.leave_requests (epd_id)
WHERE epd_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_hr_leave_requests()
RETURNS SETOF public.leave_requests
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_hr(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT lr.*
  FROM public.leave_requests lr
  WHERE lr.is_demo = false OR lr.is_demo IS NULL
  ORDER BY lr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hr_leave_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hr_leave_requests() TO service_role;