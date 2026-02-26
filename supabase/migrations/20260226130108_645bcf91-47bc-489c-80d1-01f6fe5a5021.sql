
-- Department-level approver mappings
CREATE TABLE public.leave_department_approvers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL UNIQUE,
  approver_user_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.leave_department_approvers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated users can view department approvers"
  ON public.leave_department_approvers FOR SELECT
  USING (true);

-- HR can manage
CREATE POLICY "HR can manage department approvers"
  ON public.leave_department_approvers FOR ALL
  USING (can_manage_hr(auth.uid()))
  WITH CHECK (can_manage_hr(auth.uid()));
