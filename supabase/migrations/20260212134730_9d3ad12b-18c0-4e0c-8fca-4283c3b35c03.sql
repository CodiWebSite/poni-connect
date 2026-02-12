-- Table for account help requests from auth page
CREATE TABLE public.account_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT (unauthenticated users need to submit)
CREATE POLICY "Anyone can submit account requests"
  ON public.account_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only super_admin/hr can view
CREATE POLICY "Admins can view account requests"
  ON public.account_requests
  FOR SELECT
  TO authenticated
  USING (can_manage_hr(auth.uid()));

-- Only super_admin/hr can update
CREATE POLICY "Admins can update account requests"
  ON public.account_requests
  FOR UPDATE
  TO authenticated
  USING (can_manage_hr(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_account_requests_updated_at
  BEFORE UPDATE ON public.account_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
