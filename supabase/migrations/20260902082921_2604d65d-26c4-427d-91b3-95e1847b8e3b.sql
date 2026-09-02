DO $$
DECLARE
  f record;
BEGIN
  -- 1) Funcții de tip trigger: nu trebuie apelabile direct de nimeni prin API.
  --    Declanșatoarele rulează independent de acest privilegiu.
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND pg_get_function_result(p.oid) = 'trigger'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;

  -- 2) Restul funcțiilor SECURITY DEFINER: fără acces pentru utilizatori anonimi.
  --    Excepție: log_audit_event (jurnalizare evenimente de autentificare eșuată).
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND pg_get_function_result(p.oid) <> 'trigger'
      AND p.proname <> 'log_audit_event'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;