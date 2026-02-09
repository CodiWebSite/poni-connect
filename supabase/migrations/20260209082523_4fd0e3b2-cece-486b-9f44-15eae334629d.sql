
-- Add new columns to employee_personal_data
ALTER TABLE public.employee_personal_data 
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'nedeterminat',
  ADD COLUMN IF NOT EXISTS total_leave_days integer DEFAULT 21,
  ADD COLUMN IF NOT EXISTS used_leave_days integer DEFAULT 0;

-- Add unique constraint on cnp for upsert support
ALTER TABLE public.employee_personal_data 
  DROP CONSTRAINT IF EXISTS employee_personal_data_cnp_key;
ALTER TABLE public.employee_personal_data 
  ADD CONSTRAINT employee_personal_data_cnp_key UNIQUE (cnp);

-- Update sync_employee_on_signup to propagate new fields
CREATE OR REPLACE FUNCTION public.sync_employee_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  emp_data RECORD;
  new_record_id uuid;
BEGIN
  -- Check if the new user's email exists in employee_personal_data
  SELECT * INTO emp_data
  FROM public.employee_personal_data
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;
  
  -- If employee data exists, sync it
  IF FOUND THEN
    -- Update the profile with employee data (including department and position)
    UPDATE public.profiles
    SET 
      full_name = TRIM(emp_data.first_name || ' ' || emp_data.last_name),
      department = emp_data.department,
      position = emp_data.position,
      updated_at = NOW()
    WHERE user_id = NEW.id;
    
    -- Create employee_record with leave data
    INSERT INTO public.employee_records (user_id, hire_date, contract_type, total_leave_days, used_leave_days)
    VALUES (
      NEW.id, 
      emp_data.employment_date, 
      COALESCE(emp_data.contract_type, 'nedeterminat'),
      COALESCE(emp_data.total_leave_days, 21),
      COALESCE(emp_data.used_leave_days, 0)
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_leave_days = COALESCE(emp_data.total_leave_days, 21),
      used_leave_days = COALESCE(emp_data.used_leave_days, 0),
      contract_type = COALESCE(emp_data.contract_type, 'nedeterminat'),
      updated_at = NOW()
    RETURNING id INTO new_record_id;
    
    -- If we created a new record, link it to employee_personal_data
    IF new_record_id IS NOT NULL THEN
      UPDATE public.employee_personal_data
      SET employee_record_id = new_record_id, updated_at = NOW()
      WHERE id = emp_data.id;
    ELSE
      -- Get existing record id and link it
      SELECT id INTO new_record_id
      FROM public.employee_records
      WHERE user_id = NEW.id;
      
      IF new_record_id IS NOT NULL THEN
        UPDATE public.employee_personal_data
        SET employee_record_id = new_record_id, updated_at = NOW()
        WHERE id = emp_data.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update sync_existing_employees to propagate new fields
CREATE OR REPLACE FUNCTION public.sync_existing_employees()
 RETURNS TABLE(synced_count integer, emails_matched text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  emp_data RECORD;
  matched_emails text[] := '{}';
  count_synced integer := 0;
  new_record_id uuid;
BEGIN
  -- Loop through all employee_personal_data that don't have a linked record
  FOR emp_data IN 
    SELECT epd.*, p.user_id as profile_user_id
    FROM public.employee_personal_data epd
    LEFT JOIN public.profiles p ON LOWER(p.full_name) = LOWER(TRIM(epd.first_name || ' ' || epd.last_name))
      OR EXISTS (
        SELECT 1 FROM auth.users au 
        WHERE au.id = p.user_id AND LOWER(au.email) = LOWER(epd.email)
      )
    WHERE epd.employee_record_id IS NULL
      AND p.user_id IS NOT NULL
  LOOP
    -- Update profile with employee data including department and position
    UPDATE public.profiles
    SET 
      full_name = TRIM(emp_data.first_name || ' ' || emp_data.last_name),
      department = emp_data.department,
      position = emp_data.position,
      updated_at = NOW()
    WHERE user_id = emp_data.profile_user_id;
    
    -- Create or update employee_record with leave data
    INSERT INTO public.employee_records (user_id, hire_date, contract_type, total_leave_days, used_leave_days)
    VALUES (
      emp_data.profile_user_id, 
      emp_data.employment_date, 
      COALESCE(emp_data.contract_type, 'nedeterminat'),
      COALESCE(emp_data.total_leave_days, 21),
      COALESCE(emp_data.used_leave_days, 0)
    )
    ON CONFLICT (user_id) DO UPDATE SET 
      total_leave_days = COALESCE(emp_data.total_leave_days, 21),
      used_leave_days = COALESCE(emp_data.used_leave_days, 0),
      contract_type = COALESCE(emp_data.contract_type, 'nedeterminat'),
      updated_at = NOW()
    RETURNING id INTO new_record_id;
    
    -- Link employee_personal_data to the record
    UPDATE public.employee_personal_data
    SET employee_record_id = new_record_id, updated_at = NOW()
    WHERE id = emp_data.id;
    
    matched_emails := array_append(matched_emails, emp_data.email);
    count_synced := count_synced + 1;
  END LOOP;
  
  RETURN QUERY SELECT count_synced, matched_emails;
END;
$function$;
