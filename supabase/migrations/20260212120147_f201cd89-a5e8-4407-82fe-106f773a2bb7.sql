
-- Create a SECURITY DEFINER function to check if a user_id belongs to the same department as the current user
CREATE OR REPLACE FUNCTION public.user_same_department(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = _target_user_id
    AND p.department = get_user_department(auth.uid())
  );
$$;

-- Recreate the policy using SECURITY DEFINER functions for both checks
DROP POLICY IF EXISTS "Same department can view approved leave hr_requests" ON public.hr_requests;

CREATE POLICY "Same department can view approved leave hr_requests"
ON public.hr_requests
FOR SELECT
USING (
  status = 'approved'::hr_request_status
  AND request_type = 'concediu'::hr_request_type
  AND (
    user_same_department(user_id)
    OR
    epd_same_department(((details->>'epd_id')::uuid))
  )
);
