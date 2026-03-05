-- Allow designated approvers to view requests they are responsible for (any status)
CREATE POLICY "Designated approvers can view requests"
ON public.leave_requests
FOR SELECT
USING (
  is_leave_approver_for_request(auth.uid(), id)
);