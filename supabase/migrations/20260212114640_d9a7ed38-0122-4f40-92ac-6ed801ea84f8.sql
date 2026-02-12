
-- Create a SECURITY DEFINER function to check if an epd_id belongs to the same department as the current user
CREATE OR REPLACE FUNCTION public.epd_same_department(_epd_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee_personal_data epd
    WHERE epd.id = _epd_id
    AND epd.department = get_user_department(auth.uid())
  );
$$;

-- Drop and recreate the hr_requests policy to use the new function
DROP POLICY "Same department can view approved leave hr_requests" ON public.hr_requests;

CREATE POLICY "Same department can view approved leave hr_requests"
ON public.hr_requests
FOR SELECT
USING (
  status = 'approved'::hr_request_status
  AND request_type = 'concediu'::hr_request_type
  AND (
    -- When epd_id exists in details, check via SECURITY DEFINER function
    (
      (details->>'epd_id') IS NOT NULL
      AND epd_same_department((details->>'epd_id')::uuid)
    )
    OR
    -- When no epd_id, check via user_id profile department
    (
      (details->>'epd_id') IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = hr_requests.user_id
        AND p.department = get_user_department(auth.uid())
      )
    )
  )
);

-- Same fix for leave_requests policy
DROP POLICY "Same department can view approved leave requests" ON public.leave_requests;

CREATE POLICY "Same department can view approved leave requests"
ON public.leave_requests
FOR SELECT
USING (
  status = 'approved'::leave_request_status
  AND (
    (
      epd_id IS NOT NULL
      AND epd_same_department(epd_id)
    )
    OR
    (
      epd_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = leave_requests.user_id
        AND p.department = get_user_department(auth.uid())
      )
    )
  )
);
