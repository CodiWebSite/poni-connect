-- Allow HR/super_admin to delete any leave request
CREATE POLICY "HR can delete any leave request"
ON public.leave_requests
FOR DELETE
USING (can_manage_hr(auth.uid()));

-- Allow users to delete their own requests regardless of status (for testing)
DROP POLICY IF EXISTS "Users can delete own draft requests" ON public.leave_requests;
CREATE POLICY "Users can delete own requests"
ON public.leave_requests
FOR DELETE
USING (auth.uid() = user_id);