CREATE OR REPLACE FUNCTION public.prevent_leave_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block self-approval as department head
  IF NEW.dept_head_id IS NOT NULL AND NEW.dept_head_id = NEW.user_id THEN
    RAISE EXCEPTION 'Nu vă puteți aproba singur cererea de concediu (șef departament). Solicitați aprobarea de la un aprobator desemnat sau de la SRUS.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Block self-rejection
  IF NEW.rejected_by IS NOT NULL AND NEW.rejected_by = NEW.user_id THEN
    RAISE EXCEPTION 'Nu vă puteți respinge singur cererea de concediu.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Block self-approval as director
  IF NEW.director_id IS NOT NULL AND NEW.director_id = NEW.user_id THEN
    RAISE EXCEPTION 'Nu vă puteți aproba singur cererea de concediu (director).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_leave_self_approval ON public.leave_requests;
CREATE TRIGGER trg_prevent_leave_self_approval
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_leave_self_approval();