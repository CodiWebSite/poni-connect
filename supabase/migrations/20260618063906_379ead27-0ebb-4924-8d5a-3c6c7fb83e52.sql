
-- Doctor (medic_medicina_muncii) needs to see all employees to manage medical files
CREATE POLICY "Doctor can view all employee personal data"
ON public.employee_personal_data
FOR SELECT
TO authenticated
USING (public.can_manage_medical(auth.uid()));

-- Doctor needs to see profiles (names, dept, position) used across the medical UI
CREATE POLICY "Doctor can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_manage_medical(auth.uid()));

-- Doctor needs employee_records (hire_date etc.) for medical record context
CREATE POLICY "Doctor can view employee records"
ON public.employee_records
FOR SELECT
TO authenticated
USING (public.can_manage_medical(auth.uid()));
