-- Allow HR to insert hr_requests on behalf of employees
CREATE POLICY "HR can insert hr_requests for employees"
  ON public.hr_requests FOR INSERT
  WITH CHECK (can_manage_hr(auth.uid()));