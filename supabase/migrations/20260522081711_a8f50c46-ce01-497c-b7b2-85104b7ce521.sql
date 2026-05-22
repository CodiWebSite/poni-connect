-- Fix pgcrypto schema qualification in PIN functions
CREATE OR REPLACE FUNCTION public.rotate_department_pin(_department_key text, _new_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (has_role(v_actor, 'super_admin'::app_role) OR has_role(v_actor, 'secretariat'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_pin IS NULL OR length(_new_pin) < 6 THEN
    RAISE EXCEPTION 'pin_too_short';
  END IF;

  UPDATE public.registry_department_settings
    SET pin_hash = extensions.crypt(_new_pin, extensions.gen_salt('bf', 10)),
        pin_rotated_at = now(),
        pin_rotated_by = v_actor
    WHERE department_key = _department_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'department_not_found';
  END IF;

  UPDATE public.registry_pin_state
    SET failed_count = 0, locked_until = NULL
    WHERE department_key = _department_key;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_pin_rotated', 'registry_department_settings', _department_key,
    jsonb_build_object('department_key', _department_key));
END;
$function$;

-- Also fix verifier to be safe (uses crypt for compare)
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='_verify_registry_pin' LIMIT 1;
  IF v_src IS NOT NULL AND v_src !~ 'extensions\.' THEN
    EXECUTE replace(replace(v_src,
      'SET search_path TO ''public''', 'SET search_path TO ''public'', ''extensions'''),
      'SET search_path TO public', 'SET search_path TO public, extensions');
  END IF;
END $$;