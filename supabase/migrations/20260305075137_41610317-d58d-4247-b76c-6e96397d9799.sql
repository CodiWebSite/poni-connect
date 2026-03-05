
-- Create a security definer function to check if a user is a designated approver for a leave request
CREATE OR REPLACE FUNCTION public.is_leave_approver_for_request(_user_id uuid, _request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Direct approver assignment on the request
    SELECT 1 FROM leave_requests lr
    WHERE lr.id = _request_id AND lr.approver_id = _user_id
  )
  OR EXISTS (
    -- Per-employee approver
    SELECT 1 FROM leave_requests lr
    JOIN leave_approvers la ON la.employee_user_id = lr.user_id
    WHERE lr.id = _request_id AND la.approver_user_id = _user_id
  )
  OR EXISTS (
    -- Department-level approver
    SELECT 1 FROM leave_requests lr
    JOIN employee_personal_data epd ON epd.id = lr.epd_id
    JOIN leave_department_approvers lda ON lda.department = epd.department
    WHERE lr.id = _request_id AND lda.approver_user_id = _user_id
  )
  OR EXISTS (
    -- Active delegate for the original approver
    SELECT 1 FROM leave_requests lr
    JOIN leave_approval_delegates d ON d.delegator_user_id = lr.approver_id
    WHERE lr.id = _request_id
      AND d.delegate_user_id = _user_id
      AND d.is_active = true
      AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
  )
$$;

-- Add UPDATE policy for designated approvers (covers department-level and delegates)
CREATE POLICY "Designated approvers can update pending requests"
ON public.leave_requests
FOR UPDATE
USING (
  status = 'pending_department_head'::leave_request_status
  AND is_leave_approver_for_request(auth.uid(), id)
);
