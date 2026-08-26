CREATE OR REPLACE FUNCTION public.can_create_leave_notification(
  _actor_id uuid,
  _target_user_id uuid,
  _related_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _actor_id IS NOT NULL
    AND _target_user_id IS NOT NULL
    AND _related_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      LEFT JOIN public.employee_personal_data epd ON epd.id = lr.epd_id
      LEFT JOIN public.profiles employee_profile ON employee_profile.user_id = lr.user_id
      WHERE lr.id = _related_id
        AND (
          -- The employee who submitted the leave request may notify the designated approver.
          (lr.user_id = _actor_id AND lr.approver_id = _target_user_id)

          OR

          -- The submitter may notify active delegates of the designated approver.
          (
            lr.user_id = _actor_id
            AND EXISTS (
              SELECT 1
              FROM public.leave_approval_delegates d
              WHERE d.delegator_user_id = lr.approver_id
                AND d.delegate_user_id = _target_user_id
                AND d.is_active = true
                AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
            )
          )

          OR

          -- Fallback path: the submitter may notify same-department heads/SRUS heads.
          (
            lr.user_id = _actor_id
            AND EXISTS (
              SELECT 1
              FROM public.profiles target_profile
              JOIN public.user_roles target_role ON target_role.user_id = target_profile.user_id
              WHERE target_profile.user_id = _target_user_id
                AND target_role.role IN ('sef'::public.app_role, 'sef_srus'::public.app_role)
                AND target_profile.department IS NOT NULL
                AND target_profile.department = COALESCE(epd.department, employee_profile.department)
            )
          )

          OR

          -- A valid approver/delegate may notify the employee about the decision.
          (
            _target_user_id = lr.user_id
            AND public.is_leave_approver_for_request(_actor_id, lr.id)
          )

          OR

          -- A valid approver/delegate may notify HR/SRUS/super_admin after department approval.
          (
            public.is_leave_approver_for_request(_actor_id, lr.id)
            AND EXISTS (
              SELECT 1
              FROM public.user_roles target_role
              WHERE target_role.user_id = _target_user_id
                AND target_role.role IN ('hr'::public.app_role, 'sef_srus'::public.app_role, 'super_admin'::public.app_role)
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_create_leave_notification(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_leave_notification(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_leave_notification(uuid, uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "System roles can create notifications" ON public.notifications;

CREATE POLICY "System roles can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.can_manage_content(auth.uid())
  OR public.can_manage_hr(auth.uid())
  OR public.can_manage_procurement(auth.uid())
  OR (
    related_type = 'leave_request'
    AND public.can_create_leave_notification(auth.uid(), user_id, related_id)
  )
);