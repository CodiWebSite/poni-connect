
-- Fix search_path for generate_leave_request_number
CREATE OR REPLACE FUNCTION public.generate_leave_request_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 'CO-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('leave_request_number_seq')::text, 4, '0');
$$;
