
-- Function to resolve leave approver email mappings on signup
CREATE OR REPLACE FUNCTION public.resolve_leave_approvers_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Resolve as employee
  UPDATE public.leave_approvers
  SET employee_user_id = NEW.id
  WHERE employee_email IS NOT NULL
    AND LOWER(employee_email) = LOWER(NEW.email)
    AND employee_user_id IS NULL;

  -- Resolve as approver
  UPDATE public.leave_approvers
  SET approver_user_id = NEW.id
  WHERE approver_email IS NOT NULL
    AND LOWER(approver_email) = LOWER(NEW.email)
    AND approver_user_id IS NULL;

  -- Resolve department approvers
  UPDATE public.leave_department_approvers
  SET approver_user_id = NEW.id
  WHERE approver_email IS NOT NULL
    AND LOWER(approver_email) = LOWER(NEW.email)
    AND approver_user_id IS NULL;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users on insert
CREATE TRIGGER on_auth_user_created_resolve_approvers
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_leave_approvers_on_signup();
