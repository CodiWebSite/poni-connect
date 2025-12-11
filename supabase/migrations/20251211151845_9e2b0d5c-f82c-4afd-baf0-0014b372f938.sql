-- Fix search_path for procurement functions
ALTER FUNCTION generate_procurement_request_number() SET search_path = public;
ALTER FUNCTION set_procurement_request_number() SET search_path = public;