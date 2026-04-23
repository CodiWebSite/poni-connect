-- Trigger function: assign 'sef' role to department approvers automatically
CREATE OR REPLACE FUNCTION public.auto_assign_sef_role_on_approver_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approver_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.approver_user_id, 'sef'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_sef_on_dept_approver ON public.leave_department_approvers;
CREATE TRIGGER trg_auto_assign_sef_on_dept_approver
AFTER INSERT OR UPDATE OF approver_user_id ON public.leave_department_approvers
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_sef_role_on_approver_insert();

-- Backfill: assign 'sef' role to all existing department approvers
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT lda.approver_user_id, 'sef'::app_role
FROM public.leave_department_approvers lda
WHERE lda.approver_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;