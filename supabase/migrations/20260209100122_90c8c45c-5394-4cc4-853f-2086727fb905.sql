
-- Create table for employee data correction requests
CREATE TABLE public.data_correction_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  current_value TEXT,
  requested_value TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_correction_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own correction requests
CREATE POLICY "Users can view own correction requests"
ON public.data_correction_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create correction requests
CREATE POLICY "Users can create correction requests"
ON public.data_correction_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- HR can view all correction requests
CREATE POLICY "HR can view all correction requests"
ON public.data_correction_requests
FOR SELECT
USING (can_manage_hr(auth.uid()));

-- HR can update correction requests
CREATE POLICY "HR can update correction requests"
ON public.data_correction_requests
FOR UPDATE
USING (can_manage_hr(auth.uid()));

-- HR can delete correction requests
CREATE POLICY "HR can delete correction requests"
ON public.data_correction_requests
FOR DELETE
USING (can_manage_hr(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_data_correction_requests_updated_at
BEFORE UPDATE ON public.data_correction_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
