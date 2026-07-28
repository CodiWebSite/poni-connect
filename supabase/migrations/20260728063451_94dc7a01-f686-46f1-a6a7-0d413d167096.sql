DROP POLICY IF EXISTS "Employee views own payslips if pilot" ON public.payslips;

CREATE POLICY "Employees view own distributed payslips"
ON public.payslips
FOR SELECT
TO authenticated
USING (
  match_status = 'distributed'::payslip_match_status
  AND EXISTS (
    SELECT 1
    FROM employee_personal_data epd
    JOIN employee_records er ON er.id = epd.employee_record_id
    WHERE epd.id = payslips.employee_epd_id
      AND er.user_id = auth.uid()
  )
);