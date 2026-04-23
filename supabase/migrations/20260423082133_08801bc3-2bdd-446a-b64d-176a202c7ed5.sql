CREATE OR REPLACE FUNCTION public.is_leave_approver_for_epd(_user_id uuid, _epd_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_personal_data epd
    JOIN public.leave_department_approvers lda
      ON lda.department = epd.department
    WHERE epd.id = _epd_id
      AND lda.approver_user_id = _user_id
  );
$$;

CREATE POLICY "Leave approvers can view EPD of approved departments"
ON public.employee_personal_data
FOR SELECT
TO authenticated
USING (public.is_leave_approver_for_epd(auth.uid(), id));