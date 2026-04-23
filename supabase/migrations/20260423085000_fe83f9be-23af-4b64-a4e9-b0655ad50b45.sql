-- Audit trigger for user_roles changes (assign / remove)
CREATE OR REPLACE FUNCTION public.audit_user_roles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(v_actor, NEW.user_id),
      'role_assigned',
      'user_roles',
      NEW.user_id::text,
      jsonb_build_object(
        'role', NEW.role,
        'target_user_id', NEW.user_id,
        'actor_user_id', v_actor,
        'source', CASE WHEN v_actor IS NULL THEN 'system_trigger' ELSE 'manual' END
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(v_actor, OLD.user_id),
      'role_removed',
      'user_roles',
      OLD.user_id::text,
      jsonb_build_object(
        'role', OLD.role,
        'target_user_id', OLD.user_id,
        'actor_user_id', v_actor
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_roles_ins ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles_ins
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_changes();

DROP TRIGGER IF EXISTS trg_audit_user_roles_del ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles_del
AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_changes();