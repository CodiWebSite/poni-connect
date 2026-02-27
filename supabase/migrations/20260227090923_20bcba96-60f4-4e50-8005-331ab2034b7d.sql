
-- Create leave_approval_delegates table
CREATE TABLE public.leave_approval_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_user_id uuid NOT NULL,
  delegate_user_id uuid NOT NULL,
  department text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_approval_delegates ENABLE ROW LEVEL SECURITY;

-- Delegators can manage their own delegations
CREATE POLICY "Delegators can view own delegations"
  ON public.leave_approval_delegates FOR SELECT
  USING (auth.uid() = delegator_user_id);

CREATE POLICY "Delegators can insert own delegations"
  ON public.leave_approval_delegates FOR INSERT
  WITH CHECK (auth.uid() = delegator_user_id);

CREATE POLICY "Delegators can update own delegations"
  ON public.leave_approval_delegates FOR UPDATE
  USING (auth.uid() = delegator_user_id);

CREATE POLICY "Delegators can delete own delegations"
  ON public.leave_approval_delegates FOR DELETE
  USING (auth.uid() = delegator_user_id);

-- Delegates can view delegations assigned to them
CREATE POLICY "Delegates can view assigned delegations"
  ON public.leave_approval_delegates FOR SELECT
  USING (auth.uid() = delegate_user_id);

-- HR can manage all delegations
CREATE POLICY "HR can manage all delegations"
  ON public.leave_approval_delegates FOR ALL
  USING (can_manage_hr(auth.uid()))
  WITH CHECK (can_manage_hr(auth.uid()));
