-- Create enum for HR request types
CREATE TYPE public.hr_request_type AS ENUM ('concediu', 'adeverinta', 'delegatie', 'demisie');

-- Create enum for HR request status
CREATE TYPE public.hr_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create HR requests table
CREATE TABLE public.hr_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  request_type hr_request_type NOT NULL,
  status hr_request_status NOT NULL DEFAULT 'pending',
  details JSONB NOT NULL DEFAULT '{}',
  generated_content TEXT,
  approver_id UUID,
  approver_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own HR requests"
ON public.hr_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all HR requests"
ON public.hr_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can create their own requests
CREATE POLICY "Users can create HR requests"
ON public.hr_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending requests
CREATE POLICY "Users can update their own pending requests"
ON public.hr_requests
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can update any request (for approval)
CREATE POLICY "Admins can update HR requests"
ON public.hr_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete requests
CREATE POLICY "Admins can delete HR requests"
ON public.hr_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_hr_requests_updated_at
BEFORE UPDATE ON public.hr_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for HR requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_requests;