CREATE OR REPLACE FUNCTION public.prevent_overlapping_leave_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nr text;
BEGIN
  IF NEW.status::text IN ('rejected','cancelled') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.start_date = OLD.start_date AND NEW.end_date = OLD.end_date
     AND OLD.status::text NOT IN ('rejected','cancelled') THEN RETURN NEW; END IF;
  SELECT lr.request_number INTO _nr FROM public.leave_requests lr
  WHERE lr.id <> NEW.id
    AND lr.status::text NOT IN ('rejected','cancelled')
    AND COALESCE(lr.is_demo,false) = COALESCE(NEW.is_demo,false)
    AND (lr.user_id = NEW.user_id OR (NEW.epd_id IS NOT NULL AND lr.epd_id = NEW.epd_id))
    AND lr.start_date <= NEW.end_date AND lr.end_date >= NEW.start_date
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Există deja o cerere de concediu (%) care se suprapune cu această perioadă.', _nr
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_overlapping_leave_requests ON public.leave_requests;
CREATE TRIGGER trg_prevent_overlapping_leave_requests
BEFORE INSERT OR UPDATE OF start_date, end_date, status ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.prevent_overlapping_leave_requests();