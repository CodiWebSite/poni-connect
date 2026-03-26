CREATE OR REPLACE FUNCTION public.is_leave_approver_for_request(_user_id uuid, _request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leave_requests lr
    WHERE lr.id = _request_id AND lr.approver_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM leave_requests lr
    JOIN leave_approvers la ON la.employee_user_id = lr.user_id
    WHERE lr.id = _request_id AND la.approver_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM leave_requests lr
    JOIN employee_personal_data epd ON epd.id = lr.epd_id
    JOIN leave_department_approvers lda ON lda.department = epd.department
    WHERE lr.id = _request_id AND lda.approver_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM leave_requests lr
    JOIN leave_approval_delegates d ON d.delegator_user_id = lr.approver_id
    WHERE lr.id = _request_id
      AND d.delegate_user_id = _user_id
      AND d.is_active = true
      AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
  )
  OR EXISTS (
    SELECT 1 FROM leave_requests lr
    JOIN employee_personal_data epd ON epd.id = lr.epd_id
    JOIN leave_department_approvers lda ON lda.department = epd.department
    JOIN leave_approval_delegates d ON d.delegator_user_id = lda.approver_user_id
    WHERE lr.id = _request_id
      AND d.delegate_user_id = _user_id
      AND d.is_active = true
      AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
  )
$$