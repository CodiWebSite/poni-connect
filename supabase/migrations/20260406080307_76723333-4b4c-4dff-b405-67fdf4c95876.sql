
-- 1. Create security_events table (if not already created by a prior migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_events') THEN
    CREATE TABLE public.security_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      severity text NOT NULL DEFAULT 'info',
      ip_address text,
      user_agent text,
      details jsonb DEFAULT '{}',
      acknowledged boolean DEFAULT false,
      acknowledged_by uuid,
      acknowledged_at timestamptz,
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS policies for security_events (drop if exist to be idempotent)
DROP POLICY IF EXISTS "Users can view own security events" ON public.security_events;
CREATE POLICY "Users can view own security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admin can view all security events" ON public.security_events;
CREATE POLICY "Super admin can view all security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Service role can insert security events" ON public.security_events;
CREATE POLICY "Service role can insert security events"
  ON public.security_events FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin can update security events" ON public.security_events;
CREATE POLICY "Super admin can update security events"
  ON public.security_events FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 2. Extend audit_logs with user_agent and role_at_time
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS role_at_time text;

-- 3. Trigger on user_roles to auto-log role changes
CREATE OR REPLACE FUNCTION public.audit_role_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      'role_change',
      'user_role',
      NEW.user_id::text,
      jsonb_build_object(
        'old_role', OLD.role::text,
        'new_role', NEW.role::text,
        'changed_by', COALESCE(auth.uid()::text, 'system')
      )
    );
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      NEW.user_id,
      'role_change',
      'critical',
      jsonb_build_object(
        'old_role', OLD.role::text,
        'new_role', NEW.role::text,
        'message', 'Rolul a fost schimbat din ' || OLD.role::text || ' în ' || NEW.role::text
      )
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      'role_assigned',
      'user_role',
      NEW.user_id::text,
      jsonb_build_object('role', NEW.role::text)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      'role_removed',
      'user_role',
      OLD.user_id::text,
      jsonb_build_object('role', OLD.role::text)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- 4. Fix search_path on vulnerable functions
CREATE OR REPLACE FUNCTION public.calc_archive_retention()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.retention_years >= 100 THEN
    NEW.retention_expires_at := '9999-12-31'::date;
  ELSE
    NEW.retention_expires_at := (NEW.archived_at + (NEW.retention_years || ' years')::interval)::date;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_archive_reg_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  NEW.registration_number := 'ARH-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('archive_reg_seq')::text, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admin_helpdesk_ticket()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role IN ('super_admin')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      admin_record.user_id,
      'Tichet HelpDesk nou',
      NEW.name || ' (' || NEW.email || ') — ' || COALESCE(NEW.subject, 'General'),
      'warning',
      'helpdesk_ticket',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Enable realtime for security_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;
