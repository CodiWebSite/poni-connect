
-- Drop and recreate with proper WITH CHECK
DROP POLICY IF EXISTS "Designated approvers can update pending requests" ON public.leave_requests;

CREATE POLICY "Designated approvers can update pending requests"
ON public.leave_requests
FOR UPDATE
USING (
  status = 'pending_department_head'::leave_request_status
  AND is_leave_approver_for_request(auth.uid(), id)
)
WITH CHECK (true);

-- Fix the same issue on the existing "Approvers can update assigned requests" policy
DROP POLICY IF EXISTS "Approvers can update assigned requests" ON public.leave_requests;

CREATE POLICY "Approvers can update assigned requests"
ON public.leave_requests
FOR UPDATE
USING (
  approver_id = auth.uid()
  AND status = 'pending_department_head'::leave_request_status
)
WITH CHECK (true);

-- Fix "Dept heads can update pending requests" too
DROP POLICY IF EXISTS "Dept heads can update pending requests" ON public.leave_requests;

CREATE POLICY "Dept heads can update pending requests"
ON public.leave_requests
FOR UPDATE
USING (
  (has_role(auth.uid(), 'sef'::app_role) OR has_role(auth.uid(), 'sef_srus'::app_role))
  AND status = 'pending_department_head'::leave_request_status
)
WITH CHECK (true);
