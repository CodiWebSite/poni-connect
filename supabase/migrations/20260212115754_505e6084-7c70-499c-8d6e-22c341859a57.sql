
-- Drop the existing policy
DROP POLICY IF EXISTS "Same department can view approved leave hr_requests" ON public.hr_requests;

-- Create a simpler policy that checks department via user_id OR via epd_id
CREATE POLICY "Same department can view approved leave hr_requests"
ON public.hr_requests
FOR SELECT
USING (
  status = 'approved'::hr_request_status
  AND request_type = 'concediu'::hr_request_type
  AND (
    -- Check via the user_id who submitted the request
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = hr_requests.user_id
      AND p.department = get_user_department(auth.uid())
    )
    OR
    -- Check via epd_id using SECURITY DEFINER function
    epd_same_department(((details->>'epd_id')::uuid))
  )
);
