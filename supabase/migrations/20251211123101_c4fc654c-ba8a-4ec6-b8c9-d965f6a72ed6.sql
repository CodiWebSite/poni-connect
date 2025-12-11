-- Add signature fields to hr_requests table
ALTER TABLE public.hr_requests 
ADD COLUMN IF NOT EXISTS employee_signature TEXT,
ADD COLUMN IF NOT EXISTS employee_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS department_head_signature TEXT,
ADD COLUMN IF NOT EXISTS department_head_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS department_head_id UUID REFERENCES auth.users(id);

-- Update the request_type enum to include more specific types if needed
-- Add a view for department heads to see requests from their department
CREATE OR REPLACE VIEW public.department_requests AS
SELECT hr.*,
       p.full_name as requester_name,
       p.department as requester_department,
       p.position as requester_position
FROM public.hr_requests hr
JOIN public.profiles p ON hr.user_id = p.user_id;

-- Grant access to the view
GRANT SELECT ON public.department_requests TO authenticated;