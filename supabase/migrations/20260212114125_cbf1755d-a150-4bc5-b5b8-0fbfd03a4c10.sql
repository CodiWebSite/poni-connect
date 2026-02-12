
-- Drop the overly permissive policies
DROP POLICY "All authenticated can view approved leave requests" ON public.leave_requests;
DROP POLICY "All authenticated can view approved leave hr_requests" ON public.hr_requests;

-- Create a helper function to get user's department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Allow users to see approved leave_requests from same department
-- We check via epd_id (employee_personal_data) or via user_id (profiles)
CREATE POLICY "Same department can view approved leave requests"
ON public.leave_requests
FOR SELECT
USING (
  status = 'approved'::leave_request_status
  AND (
    -- Match by epd_id department
    EXISTS (
      SELECT 1 FROM employee_personal_data epd
      WHERE epd.id = leave_requests.epd_id
      AND epd.department = get_user_department(auth.uid())
    )
    OR
    -- Match by user_id profile department (when no epd_id)
    (
      leave_requests.epd_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = leave_requests.user_id
        AND p.department = get_user_department(auth.uid())
      )
    )
  )
);

-- Same for hr_requests (concediu type)
CREATE POLICY "Same department can view approved leave hr_requests"
ON public.hr_requests
FOR SELECT
USING (
  status = 'approved'::hr_request_status
  AND request_type = 'concediu'::hr_request_type
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = hr_requests.user_id
    AND p.department = get_user_department(auth.uid())
  )
);
