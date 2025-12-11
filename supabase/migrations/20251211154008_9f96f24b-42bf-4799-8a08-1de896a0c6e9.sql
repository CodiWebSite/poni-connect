-- Add signature columns to procurement_requests
ALTER TABLE public.procurement_requests 
ADD COLUMN IF NOT EXISTS employee_signature text,
ADD COLUMN IF NOT EXISTS employee_signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approver_signature text,
ADD COLUMN IF NOT EXISTS approver_signed_at timestamp with time zone;