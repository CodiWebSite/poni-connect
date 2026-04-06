
-- Fix security definer views → recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.employee_directory CASCADE;
CREATE VIEW public.employee_directory
  WITH (security_invoker = true)
AS
SELECT id, user_id, full_name, department, position, avatar_url, birth_date, created_at, updated_at
FROM profiles;

DROP VIEW IF EXISTS public.employee_directory_full CASCADE;
CREATE VIEW public.employee_directory_full
  WITH (security_invoker = true)
AS
SELECT epd.id,
    epd.first_name,
    epd.last_name,
    TRIM(BOTH FROM epd.last_name || ' ' || epd.first_name) AS full_name,
    epd.department,
    epd.position,
    epd.email,
    p.avatar_url,
    p.user_id
FROM employee_personal_data epd
LEFT JOIN profiles p ON p.user_id = (
    SELECT er.user_id FROM employee_records er WHERE er.id = epd.employee_record_id LIMIT 1
)
WHERE epd.is_archived = false
ORDER BY epd.last_name, epd.first_name;

-- Fix leave_requests UPDATE policies: restrict WITH CHECK to valid status transitions
DROP POLICY IF EXISTS "Approvers can update assigned requests" ON public.leave_requests;
CREATE POLICY "Approvers can update assigned requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (approver_id = auth.uid() AND status = 'pending_department_head')
  WITH CHECK (status IN ('pending_department_head', 'pending_srus', 'approved', 'rejected'));

DROP POLICY IF EXISTS "Dept heads can update pending requests" ON public.leave_requests;
CREATE POLICY "Dept heads can update pending requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'sef') OR has_role(auth.uid(), 'sef_srus')) AND status = 'pending_department_head')
  WITH CHECK (status IN ('pending_department_head', 'pending_srus', 'approved', 'rejected'));

DROP POLICY IF EXISTS "Designated approvers can update pending requests" ON public.leave_requests;
CREATE POLICY "Designated approvers can update pending requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (status = 'pending_department_head' AND is_leave_approver_for_request(auth.uid(), id))
  WITH CHECK (status IN ('pending_department_head', 'pending_srus', 'approved', 'rejected'));
