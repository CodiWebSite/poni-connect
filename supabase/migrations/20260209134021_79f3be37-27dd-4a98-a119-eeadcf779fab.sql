
-- Add ci_scan_url column to store the CI scan file path
ALTER TABLE public.employee_personal_data ADD COLUMN ci_scan_url text;
ALTER TABLE public.employee_personal_data ADD COLUMN ci_scan_uploaded_at timestamptz;
