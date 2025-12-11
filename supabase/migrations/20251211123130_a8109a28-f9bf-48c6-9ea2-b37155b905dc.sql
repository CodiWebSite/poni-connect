-- Drop the view to fix security issue - we'll use joins in queries instead
DROP VIEW IF EXISTS public.department_requests;