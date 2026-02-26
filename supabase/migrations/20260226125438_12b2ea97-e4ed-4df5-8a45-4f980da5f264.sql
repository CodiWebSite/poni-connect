
-- Create leave_approvers table for hierarchical approval mapping
CREATE TABLE public.leave_approvers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_user_id uuid NOT NULL,
  approver_user_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT leave_approvers_employee_unique UNIQUE (employee_user_id)
);

-- Add approver_id column to leave_requests
ALTER TABLE public.leave_requests ADD COLUMN approver_id uuid;

-- Enable RLS
ALTER TABLE public.leave_approvers ENABLE ROW LEVEL SECURITY;

-- HR and super_admin can manage all leave_approvers
CREATE POLICY "HR can manage leave approvers"
  ON public.leave_approvers
  FOR ALL
  USING (can_manage_hr(auth.uid()))
  WITH CHECK (can_manage_hr(auth.uid()));

-- All authenticated users can read (needed for lookup at submit time)
CREATE POLICY "Authenticated users can view leave approvers"
  ON public.leave_approvers
  FOR SELECT
  USING (true);

-- Users who are approvers can view requests assigned to them
CREATE POLICY "Approvers can view assigned requests"
  ON public.leave_requests
  FOR SELECT
  USING (approver_id = auth.uid());

-- Approvers can update requests assigned to them
CREATE POLICY "Approvers can update assigned requests"
  ON public.leave_requests
  FOR UPDATE
  USING (approver_id = auth.uid() AND status = 'pending_department_head'::leave_request_status);
