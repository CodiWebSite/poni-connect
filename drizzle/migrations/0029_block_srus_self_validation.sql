CREATE OR REPLACE FUNCTION public.prevent_leave_self_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.dept_head_id IS NOT NULL AND NEW.dept_head_id = NEW.user_id THEN
    RAISE EXCEPTION 'Nu vă puteți aproba singur cererea de concediu (șef departament). Solicitați aprobarea de la un aprobator desemnat sau de la SRUS.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.rejected_by IS NOT NULL AND NEW.rejected_by = NEW.user_id THEN
    RAISE EXCEPTION 'Nu vă puteți respinge singur cererea de concediu.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.director_id IS NOT NULL AND NEW.director_id = NEW.user_id THEN
    RAISE EXCEPTION 'Nu vă puteți aproba singur cererea de concediu (director).'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Block self-validation at SRUS step
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id
     AND OLD.status::text = 'pending_srus' AND NEW.status::text <> OLD.status::text THEN
    RAISE EXCEPTION 'Nu vă puteți valida singur cererea de concediu la SRUS. Validarea trebuie făcută de alt coleg SRUS.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;