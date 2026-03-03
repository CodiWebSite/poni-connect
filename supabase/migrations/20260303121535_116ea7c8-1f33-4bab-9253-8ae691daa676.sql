
-- Drop audiences table (and its policies)
DROP TABLE IF EXISTS public.audiences CASCADE;

-- Drop visitors table (and its policies)
DROP TABLE IF EXISTS public.visitors CASCADE;

-- Drop document_registry table (and its policies)
DROP TABLE IF EXISTS public.document_registry CASCADE;

-- Drop the document_registry sequence
DROP SEQUENCE IF EXISTS public.document_registry_seq CASCADE;

-- Drop the registration number functions
DROP FUNCTION IF EXISTS public.generate_registration_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_registration_number() CASCADE;

-- Drop the can_manage_secretariat function
DROP FUNCTION IF EXISTS public.can_manage_secretariat(uuid) CASCADE;
