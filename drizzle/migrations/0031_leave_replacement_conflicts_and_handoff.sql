ALTER TABLE public.leave_requests
  ADD COLUMN replacement_epd_id UUID REFERENCES public.employee_personal_data(id);

COMMENT ON COLUMN public.leave_requests.replacement_epd_id IS 'Înlocuitorul selectat pentru perioada concediului; replacement_name rămâne textul afișat în documente.';

CREATE INDEX idx_leave_requests_replacement_period
  ON public.leave_requests (replacement_epd_id, start_date, end_date)
  WHERE replacement_epd_id IS NOT NULL;

ALTER TABLE public.leave_approval_delegates
  ADD COLUMN transferred_from_delegation_id UUID REFERENCES public.leave_approval_delegates(id),
  ADD COLUMN transferred_by_user_id UUID,
  ADD COLUMN transferred_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN deactivated_by_user_id UUID,
  ADD COLUMN deactivated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.leave_approval_delegates.transferred_from_delegation_id IS 'Delegarea din care provine ștafeta; delegator_user_id păstrează șeful original și compartimentul original.';
COMMENT ON COLUMN public.leave_approval_delegates.transferred_by_user_id IS 'Înlocuitorul anterior care a transferat ștafeta.';

CREATE INDEX idx_leave_delegates_transferred_by
  ON public.leave_approval_delegates (transferred_by_user_id)
  WHERE transferred_by_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.has_leave_replacement_conflict(
  _epd_id UUID,
  _start_date DATE,
  _end_date DATE,
  _exclude_leave_request_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.epd_id = _epd_id
      AND lr.status IN ('pending_director', 'pending_department_head', 'pending_srus', 'approved')
      AND COALESCE(lr.is_demo, false) = false
      AND lr.start_date <= _end_date
      AND lr.end_date >= _start_date
      AND (_exclude_leave_request_id IS NULL OR lr.id <> _exclude_leave_request_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.hr_requests hr
    WHERE hr.request_type = 'concediu'
      AND hr.status = 'approved'
      AND hr.details->>'epd_id' = _epd_id::text
      AND (hr.details->>'startDate')::date <= _end_date
      AND (hr.details->>'endDate')::date >= _start_date
  );
$$;

REVOKE ALL ON FUNCTION public.has_leave_replacement_conflict(UUID, DATE, DATE, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_leave_replacement_conflict(UUID, DATE, DATE, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_leave_replacement_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.replacement_epd_id IS NULL OR NEW.status = 'rejected' OR COALESCE(NEW.is_demo, false) THEN
    RETURN NEW;
  END IF;

  IF public.has_leave_replacement_conflict(NEW.replacement_epd_id, NEW.start_date, NEW.end_date, NEW.id) THEN
    RAISE EXCEPTION 'Înlocuitorul selectat are deja un concediu aprobat sau în așteptare care se suprapune cu perioada cererii.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_leave_replacement_availability
BEFORE INSERT OR UPDATE OF replacement_epd_id, start_date, end_date, status
ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_leave_replacement_availability();

CREATE OR REPLACE FUNCTION public.validate_leave_delegate_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delegate_epd_id UUID;
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Data de sfârșit a înlocuirii trebuie să fie după data de început.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.delegator_user_id = NEW.delegate_user_id THEN
    RAISE EXCEPTION 'Nu vă puteți desemna pe dumneavoastră ca înlocuitor.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  SELECT epd.id INTO _delegate_epd_id
  FROM public.employee_records er
  JOIN public.employee_personal_data epd ON epd.employee_record_id = er.id
  WHERE er.user_id = NEW.delegate_user_id
    AND COALESCE(epd.is_archived, false) = false
  LIMIT 1;

  IF _delegate_epd_id IS NOT NULL
     AND public.has_leave_replacement_conflict(_delegate_epd_id, NEW.start_date, NEW.end_date) THEN
    RAISE EXCEPTION 'Colegul selectat are deja un concediu aprobat sau în așteptare care se suprapune cu perioada înlocuirii.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_leave_delegate_availability
BEFORE INSERT OR UPDATE OF delegator_user_id, delegate_user_id, start_date, end_date, is_active
ON public.leave_approval_delegates
FOR EACH ROW
EXECUTE FUNCTION public.validate_leave_delegate_availability();

CREATE POLICY "Transfer actors can view delegated handoffs"
ON public.leave_approval_delegates
FOR SELECT
TO authenticated
USING (transferred_by_user_id = auth.uid());