
-- ============================================================
-- M0: Pre-flight audit log
-- ============================================================
INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'pre_migration_audit',
  'user_roles',
  'admin_role_legacy',
  jsonb_build_object(
    'admin_count', (SELECT count(*) FROM public.user_roles WHERE role = 'admin'),
    'admin_user_ids', COALESCE((SELECT jsonb_agg(user_id) FROM public.user_roles WHERE role = 'admin'), '[]'::jsonb),
    'migration', 'security_gdpr_v2'
  )
);

-- ============================================================
-- M1: Drop Telegram triggers (functions remain, just unattached)
-- ============================================================
DROP TRIGGER IF EXISTS notify_telegram_on_account_request ON public.account_requests;
DROP TRIGGER IF EXISTS trg_notify_telegram_account_request ON public.account_requests;
DROP TRIGGER IF EXISTS notify_telegram_on_security_event ON public.security_events;
DROP TRIGGER IF EXISTS trg_notify_telegram_security_event ON public.security_events;

-- ============================================================
-- M4: Migrate legacy 'admin' role safely (preserve other roles)
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_other_roles text[];
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    SELECT array_agg(role::text) INTO v_other_roles
    FROM public.user_roles
    WHERE user_id = r.user_id AND role <> 'admin';

    DELETE FROM public.user_roles WHERE user_id = r.user_id AND role = 'admin';

    IF v_other_roles IS NULL OR array_length(v_other_roles, 1) IS NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, 'user')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (r.user_id, 'Actualizare rol',
        'Rolul legacy "Administrator" a fost retras. Pentru acces extins, contactează Super Admin.',
        'info');
    END IF;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      'role_legacy_migration',
      'user_roles',
      r.user_id::text,
      jsonb_build_object(
        'from', 'admin',
        'to', CASE WHEN v_other_roles IS NULL THEN 'user' ELSE 'kept_other_roles' END,
        'other_roles', COALESCE(to_jsonb(v_other_roles), '[]'::jsonb)
      )
    );
  END LOOP;
END $$;

-- ============================================================
-- M5: Remove 'admin' from permission helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_procurement(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'director', 'achizitii_contabilitate')
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_content(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','secretariat','compartiment_comunicare','director_institut','director_adjunct','secretar_stiintific')
  )
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  pre_role app_role;
  role_label text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email));

  SELECT role INTO pre_role FROM public.pre_assigned_roles
  WHERE LOWER(email) = LOWER(new.email) LIMIT 1;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, COALESCE(pre_role, 'user'));

  IF pre_role IS NOT NULL THEN
    role_label := CASE pre_role::text
      WHEN 'super_admin' THEN 'Super Admin'
      WHEN 'director_institut' THEN 'Director'
      WHEN 'director_adjunct' THEN 'Director Adjunct'
      WHEN 'secretar_stiintific' THEN 'Secretar Științific'
      WHEN 'sef_srus' THEN 'Șef Serviciu Resurse Umane'
      WHEN 'sef' THEN 'Șef Departament'
      WHEN 'hr' THEN 'HR (SRUS)'
      WHEN 'secretariat' THEN 'Secretariat'
      WHEN 'achizitii_contabilitate' THEN 'Achiziții & Contabilitate'
      WHEN 'salarizare' THEN 'Salarizare'
      WHEN 'bibliotecar' THEN 'Bibliotecar'
      WHEN 'achizitii' THEN 'Achiziții'
      WHEN 'contabilitate' THEN 'Contabilitate'
      WHEN 'oficiu_juridic' THEN 'Oficiu Juridic'
      WHEN 'compartiment_comunicare' THEN 'Compartiment Comunicare'
      WHEN 'medic_medicina_muncii' THEN 'Medic Medicina Muncii'
      ELSE 'Angajat'
    END;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (new.id, 'Rol pre-atribuit aplicat',
      'Bine ai venit! Ți-a fost atribuit rolul de ' || role_label || '.', 'success');

    DELETE FROM public.pre_assigned_roles WHERE LOWER(email) = LOWER(new.email);
  END IF;
  RETURN new;
END;
$function$;

-- ============================================================
-- M6: gdpr_officers + gdpr_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gdpr_officers (
  user_id uuid PRIMARY KEY,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  notes text
);
ALTER TABLE public.gdpr_officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages gdpr officers" ON public.gdpr_officers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Officers see own assignment" ON public.gdpr_officers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_gdpr_officer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.gdpr_officers WHERE user_id = _user_id)
$$;

CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access','rectification','restriction','deletion','portability','complaint')),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed','rejected')),
  handled_by uuid,
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own gdpr request" ON public.gdpr_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own gdpr requests" ON public.gdpr_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin') OR is_gdpr_officer(auth.uid()));

CREATE POLICY "DPO and super admin manage" ON public.gdpr_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR is_gdpr_officer(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR is_gdpr_officer(auth.uid()));

CREATE TRIGGER trg_gdpr_requests_updated
  BEFORE UPDATE ON public.gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- M7: security_incidents + bucket + policies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL,
  incident_type text NOT NULL CHECK (incident_type IN
    ('email_phishing','link_suspect','cont_compromis','dispozitiv_pierdut','fisier_suspect','altul')),
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  attachment_path text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaging','in_progress','resolved','dismissed')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  assigned_to uuid,
  hr_relevant boolean NOT NULL DEFAULT false,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users report own incidents" ON public.security_incidents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users see own incidents" ON public.security_incidents
  FOR SELECT TO authenticated
  USING (
    auth.uid() = reporter_user_id
    OR has_role(auth.uid(), 'super_admin')
    OR assigned_to = auth.uid()
    OR (hr_relevant = true AND can_manage_hr(auth.uid()))
  );

CREATE POLICY "Super admin manages incidents" ON public.security_incidents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR assigned_to = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR assigned_to = auth.uid());

CREATE POLICY "Super admin deletes incidents" ON public.security_incidents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_security_incidents_updated
  BEFORE UPDATE ON public.security_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: notify super_admin + HR on new incident
CREATE OR REPLACE FUNCTION public.notify_admin_security_incident()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role IN ('super_admin','sef_srus') LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      r.user_id,
      'Incident de securitate raportat',
      'Tip: ' || NEW.incident_type || ' — severitate: ' || NEW.severity,
      CASE WHEN NEW.severity IN ('high','critical') THEN 'warning' ELSE 'info' END,
      'incident_report', NEW.id::text
    );
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_admin_security_incident
  AFTER INSERT ON public.security_incidents
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_security_incident();

-- Storage bucket privat pentru atașamente incidente
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'security-incidents','security-incidents', false, 10485760,
  ARRAY['application/pdf','image/png','image/jpeg','text/plain','message/rfc822']
)
ON CONFLICT (id) DO UPDATE SET
  public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf','image/png','image/jpeg','text/plain','message/rfc822'];

CREATE POLICY "Users upload own incident attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'security-incidents'
    AND (storage.foldername(name))[1] = 'incidents'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users read own incident attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'security-incidents'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Super admin deletes incident attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'security-incidents' AND has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- M8: feature_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read flags" ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin writes flags" ON public.feature_flags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('internal_alerts_enabled', true, 'Notificări interne alternative pentru alerte de securitate'),
  ('incident_reporting_enabled', true, 'Permite utilizatorilor să raporteze incidente de securitate'),
  ('audit_reason_required', true, 'Cere motiv obligatoriu pentru acțiuni sensibile (Super Admin)'),
  ('gdpr_requests_enabled', true, 'Permite cereri GDPR din contul utilizator'),
  ('legacy_admin_role_visible', false, 'Afișează rolul admin legacy în dropdown-uri (dezactivat)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- M10: RLS SELECT own pentru security_events (dacă lipsește)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='security_events'
      AND policyname='Users see own security events'
  ) THEN
    CREATE POLICY "Users see own security events" ON public.security_events
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;
