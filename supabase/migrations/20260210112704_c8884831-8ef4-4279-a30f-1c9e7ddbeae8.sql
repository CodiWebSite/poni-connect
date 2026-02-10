
-- Create leave_request_status enum
DO $$ BEGIN
  CREATE TYPE public.leave_request_status AS ENUM (
    'draft',
    'pending_director',
    'pending_department_head',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create sequence for request numbers
CREATE SEQUENCE IF NOT EXISTS leave_request_number_seq START 1;

-- Function to generate leave request number
CREATE OR REPLACE FUNCTION public.generate_leave_request_number()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'CO-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('leave_request_number_seq')::text, 4, '0');
$$;

-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  epd_id uuid REFERENCES public.employee_personal_data(id),
  request_number text NOT NULL DEFAULT generate_leave_request_number(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  working_days integer NOT NULL DEFAULT 0,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  replacement_name text NOT NULL,
  replacement_position text,
  status leave_request_status NOT NULL DEFAULT 'draft',
  employee_signature text,
  employee_signed_at timestamptz,
  director_id uuid,
  director_approved_at timestamptz,
  director_notes text,
  dept_head_id uuid,
  dept_head_approved_at timestamptz,
  dept_head_notes text,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own requests
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create leave requests"
ON public.leave_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update own draft requests
CREATE POLICY "Users can update own draft requests"
ON public.leave_requests FOR UPDATE
USING (auth.uid() = user_id AND status = 'draft');

-- Users can delete own draft requests
CREATE POLICY "Users can delete own draft requests"
ON public.leave_requests FOR DELETE
USING (auth.uid() = user_id AND status = 'draft');

-- Directors can view pending_director requests
CREATE POLICY "Directors can view pending requests"
ON public.leave_requests FOR SELECT
USING (
  has_role(auth.uid(), 'director_institut') OR 
  has_role(auth.uid(), 'director_adjunct')
);

-- Directors can update pending_director requests
CREATE POLICY "Directors can update pending requests"
ON public.leave_requests FOR UPDATE
USING (
  (has_role(auth.uid(), 'director_institut') OR has_role(auth.uid(), 'director_adjunct'))
  AND status = 'pending_director'
);

-- Department heads can view pending_department_head requests
CREATE POLICY "Dept heads can view pending requests"
ON public.leave_requests FOR SELECT
USING (
  has_role(auth.uid(), 'sef') OR 
  has_role(auth.uid(), 'sef_srus')
);

-- Department heads can update pending_department_head requests
CREATE POLICY "Dept heads can update pending requests"
ON public.leave_requests FOR UPDATE
USING (
  (has_role(auth.uid(), 'sef') OR has_role(auth.uid(), 'sef_srus'))
  AND status = 'pending_department_head'
);

-- HR/Super Admin can view all requests
CREATE POLICY "HR can view all leave requests"
ON public.leave_requests FOR SELECT
USING (can_manage_hr(auth.uid()));

-- HR/Super Admin can update all requests
CREATE POLICY "HR can update all leave requests"
ON public.leave_requests FOR UPDATE
USING (can_manage_hr(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
