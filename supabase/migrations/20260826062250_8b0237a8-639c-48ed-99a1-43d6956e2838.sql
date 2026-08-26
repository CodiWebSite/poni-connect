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
    AND related_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      LEFT JOIN public.employee_personal_data epd ON epd.id = lr.epd_id
      LEFT JOIN public.profiles employee_profile ON employee_profile.user_id = lr.user_id
      WHERE lr.id = notifications.related_id
        AND (
          (lr.user_id = auth.uid() AND lr.approver_id = notifications.user_id)
          OR
          (
            lr.user_id = auth.uid()
            AND EXISTS (
              SELECT 1
              FROM public.leave_approval_delegates d
              WHERE d.delegator_user_id = lr.approver_id
                AND d.delegate_user_id = notifications.user_id
                AND d.is_active = true
                AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
            )
          )
          OR
          (
            lr.user_id = auth.uid()
            AND EXISTS (
              SELECT 1
              FROM public.profiles target_profile
              JOIN public.user_roles target_role ON target_role.user_id = target_profile.user_id
              WHERE target_profile.user_id = notifications.user_id
                AND target_role.role IN ('sef'::public.app_role, 'sef_srus'::public.app_role)
                AND target_profile.department IS NOT NULL
                AND target_profile.department = COALESCE(epd.department, employee_profile.department)
            )
          )
          OR
          (
            notifications.user_id = lr.user_id
            AND public.is_leave_approver_for_request(auth.uid(), lr.id)
          )
          OR
          (
            public.is_leave_approver_for_request(auth.uid(), lr.id)
            AND EXISTS (
              SELECT 1
              FROM public.user_roles target_role
              WHERE target_role.user_id = notifications.user_id
                AND target_role.role IN ('hr'::public.app_role, 'sef_srus'::public.app_role, 'super_admin'::public.app_role)
            )
          )
        )
    )
  )
);

DROP FUNCTION IF EXISTS public.can_create_leave_notification(uuid, uuid, uuid);