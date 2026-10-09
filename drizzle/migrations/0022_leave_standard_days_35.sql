CREATE OR REPLACE FUNCTION public.leave_standard_days(_year int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 35 $$;