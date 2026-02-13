
CREATE OR REPLACE FUNCTION public.sync_used_leave_days_to_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When used_leave_days changes in employee_personal_data, sync to employee_records
  IF NEW.employee_record_id IS NOT NULL AND (OLD.used_leave_days IS DISTINCT FROM NEW.used_leave_days OR OLD.total_leave_days IS DISTINCT FROM NEW.total_leave_days) THEN
    UPDATE public.employee_records
    SET 
      used_leave_days = COALESCE(NEW.used_leave_days, 0),
      total_leave_days = COALESCE(NEW.total_leave_days, 21),
      updated_at = NOW()
    WHERE id = NEW.employee_record_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_epd_leave_to_record
  AFTER UPDATE OF used_leave_days, total_leave_days ON public.employee_personal_data
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_used_leave_days_to_record();
