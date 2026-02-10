
-- Function to re-sync employee data when email is updated in employee_personal_data
CREATE OR REPLACE FUNCTION public.sync_employee_on_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_user_id uuid;
  new_record_id uuid;
BEGIN
  -- Only act when email changes or employee_record_id is cleared/null
  IF (TG_OP = 'UPDATE' AND (OLD.email IS DISTINCT FROM NEW.email OR OLD.employee_record_id IS DISTINCT FROM NEW.employee_record_id))
     OR (TG_OP = 'UPDATE' AND NEW.employee_record_id IS NULL)
  THEN
    -- Find auth user matching the new email
    SELECT id INTO matched_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;

    IF matched_user_id IS NOT NULL THEN
      -- Update profile with employee data
      UPDATE public.profiles
      SET 
        full_name = TRIM(NEW.first_name || ' ' || NEW.last_name),
        department = NEW.department,
        position = NEW.position,
        updated_at = NOW()
      WHERE user_id = matched_user_id;

      -- Create or update employee_record
      INSERT INTO public.employee_records (user_id, hire_date, contract_type, total_leave_days, used_leave_days)
      VALUES (
        matched_user_id,
        NEW.employment_date,
        COALESCE(NEW.contract_type, 'nedeterminat'),
        COALESCE(NEW.total_leave_days, 21),
        COALESCE(NEW.used_leave_days, 0)
      )
      ON CONFLICT (user_id) DO UPDATE SET
        hire_date = NEW.employment_date,
        contract_type = COALESCE(NEW.contract_type, 'nedeterminat'),
        total_leave_days = COALESCE(NEW.total_leave_days, 21),
        used_leave_days = COALESCE(NEW.used_leave_days, 0),
        updated_at = NOW()
      RETURNING id INTO new_record_id;

      -- Link employee_personal_data to the record
      IF new_record_id IS NOT NULL THEN
        NEW.employee_record_id := new_record_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on employee_personal_data
CREATE TRIGGER trigger_sync_employee_on_email_update
BEFORE UPDATE ON public.employee_personal_data
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_on_email_update();
