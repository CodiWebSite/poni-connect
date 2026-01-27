-- Create function to sync employee_personal_data with profiles on user signup
CREATE OR REPLACE FUNCTION public.sync_employee_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Update the profile with employee data
    UPDATE public.profiles
    SET 
      full_name = TRIM(emp_data.first_name || ' ' || emp_data.last_name),
      updated_at = NOW()
    WHERE user_id = NEW.id;
    
    -- Create employee_record if it doesn't exist
    INSERT INTO public.employee_records (user_id, hire_date, contract_type)
    VALUES (NEW.id, emp_data.employment_date, 'nedeterminat')
    ON CONFLICT (user_id) DO NOTHING
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
$$;

-- Add unique constraint on employee_records.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'employee_records_user_id_key'
  ) THEN
    ALTER TABLE public.employee_records ADD CONSTRAINT employee_records_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Create trigger on auth.users to sync employee data after signup
-- This trigger fires AFTER the handle_new_user trigger creates the profile
CREATE OR REPLACE TRIGGER on_auth_user_created_sync_employee
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_on_signup();

-- Also create a function to manually sync existing users
CREATE OR REPLACE FUNCTION public.sync_existing_employees()
RETURNS TABLE(synced_count integer, emails_matched text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_data RECORD;
  profile_data RECORD;
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
    -- Update profile with employee data
    UPDATE public.profiles
    SET 
      full_name = TRIM(emp_data.first_name || ' ' || emp_data.last_name),
      updated_at = NOW()
    WHERE user_id = emp_data.profile_user_id;
    
    -- Create or get employee_record
    INSERT INTO public.employee_records (user_id, hire_date, contract_type)
    VALUES (emp_data.profile_user_id, emp_data.employment_date, 'nedeterminat')
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
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
$$;