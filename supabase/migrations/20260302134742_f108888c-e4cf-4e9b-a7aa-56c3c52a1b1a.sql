CREATE POLICY "Salarizare can view hr_requests"
ON public.hr_requests FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));