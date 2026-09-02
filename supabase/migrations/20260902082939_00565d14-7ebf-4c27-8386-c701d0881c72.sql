DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig,
           pg_get_function_result(p.oid) = 'trigger' AS is_trigger,
           p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    -- privilegiul implicit acordat tuturor este cauza expunerii prin API
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);

    IF f.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    ELSE
      -- funcțiile ajutătoare sunt evaluate în politicile RLS ale utilizatorului
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;

  -- excepție: jurnalizarea evenimentelor de autentificare eșuată (context neautentificat)
  GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) TO anon;
END $$;