
-- Allow all authenticated users to see approved leave requests (for calendar visibility)
CREATE POLICY "All authenticated can view approved leave requests"
ON public.leave_requests
FOR SELECT
USING (status = 'approved'::leave_request_status);

-- Allow all authenticated users to see approved hr_requests of type concediu (for calendar visibility)
CREATE POLICY "All authenticated can view approved leave hr_requests"
ON public.hr_requests
FOR SELECT
USING (status = 'approved'::hr_request_status AND request_type = 'concediu'::hr_request_type);
