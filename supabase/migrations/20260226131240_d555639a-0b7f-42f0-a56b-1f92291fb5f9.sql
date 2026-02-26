
ALTER TABLE public.leave_approvers DROP CONSTRAINT IF EXISTS leave_approvers_employee_unique;

ALTER TABLE public.leave_approvers 
  ALTER COLUMN employee_user_id DROP NOT NULL,
  ALTER COLUMN approver_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS employee_email TEXT,
  ADD COLUMN IF NOT EXISTS approver_email TEXT;

ALTER TABLE public.leave_approvers DROP CONSTRAINT IF EXISTS leave_approvers_employee_user_id_key;

CREATE UNIQUE INDEX leave_approvers_employee_unique 
  ON public.leave_approvers (COALESCE(employee_user_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(employee_email, ''));

ALTER TABLE public.leave_department_approvers
  ALTER COLUMN approver_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS approver_email TEXT;
