
-- Allow users to view their own personal data via their employee_record_id
CREATE POLICY "Users can view own personal data"
ON public.employee_personal_data
FOR SELECT
USING (
  employee_record_id IN (
    SELECT id FROM public.employee_records WHERE user_id = auth.uid()
  )
);
