
-- ============================================================
-- BATCH 3 — Registratură Digitală: PIN, RPC-uri, atașamente
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. PIN columns on registry_department_settings
-- ------------------------------------------------------------
ALTER TABLE public.registry_department_settings
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_rotated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pin_max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pin_lockout_minutes integer NOT NULL DEFAULT 15;

-- ------------------------------------------------------------
-- 2. registry_pin_state
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registry_pin_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_key text NOT NULL REFERENCES public.registry_department_settings(department_key) ON UPDATE CASCADE ON DELETE CASCADE,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_key)
);

ALTER TABLE public.registry_pin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rps_select_super_admin" ON public.registry_pin_state
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "rps_no_writes" ON public.registry_pin_state
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER trg_rps_updated_at BEFORE UPDATE ON public.registry_pin_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3. registry_attachments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registry_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.registry_requests(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.registry_entries(id) ON DELETE RESTRICT,
  bucket text NOT NULL DEFAULT 'registry-attachments',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registry_attachments_target_check CHECK (request_id IS NOT NULL OR entry_id IS NOT NULL),
  UNIQUE (bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_registry_attachments_request ON public.registry_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_registry_attachments_entry ON public.registry_attachments(entry_id);
CREATE INDEX IF NOT EXISTS idx_registry_attachments_is_demo ON public.registry_attachments(is_demo);

ALTER TABLE public.registry_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin all; secretariat for requests/entries they can manage (excluding restricted_management content unless authorized);
-- operators for their dept (excluding restricted_management).
CREATE POLICY "ra_select_super_admin" ON public.registry_attachments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "ra_select_via_request_visibility" ON public.registry_attachments
  FOR SELECT TO authenticated USING (
    request_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.registry_requests r
      WHERE r.id = registry_attachments.request_id
        AND (
          (can_manage_registry(auth.uid()) AND r.confidentiality <> 'restricted_management')
          OR (r.confidentiality = 'restricted_management' AND can_view_restricted_management(auth.uid()))
          OR (r.source_department_key = get_user_registry_dept_key(auth.uid())
              AND r.confidentiality <> 'restricted_management')
        )
    )
  );

CREATE POLICY "ra_select_via_entry_visibility" ON public.registry_attachments
  FOR SELECT TO authenticated USING (
    entry_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.registry_entries e
      WHERE e.id = registry_attachments.entry_id
        AND (
          (can_manage_registry(auth.uid()) AND e.confidentiality <> 'restricted_management')
          OR (e.confidentiality = 'restricted_management' AND can_view_restricted_management(auth.uid()))
          OR (e.source_department_key = get_user_registry_dept_key(auth.uid())
              AND e.confidentiality <> 'restricted_management')
        )
    )
  );

CREATE POLICY "ra_no_direct_writes" ON public.registry_attachments
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ------------------------------------------------------------
-- 4. registry_orphan_storage
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registry_orphan_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  storage_path text NOT NULL,
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registry_orphan_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ros_select_super_admin" ON public.registry_orphan_storage
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "ros_no_writes" ON public.registry_orphan_storage
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER trg_ros_updated_at BEFORE UPDATE ON public.registry_orphan_storage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 5. updated_at triggers on remaining registry tables
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_registry_requests_updated_at ON public.registry_requests;
CREATE TRIGGER trg_registry_requests_updated_at BEFORE UPDATE ON public.registry_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_registry_entries_updated_at ON public.registry_entries;
CREATE TRIGGER trg_registry_entries_updated_at BEFORE UPDATE ON public.registry_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_registry_assignments_updated_at ON public.registry_assignments;
CREATE TRIGGER trg_registry_assignments_updated_at BEFORE UPDATE ON public.registry_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_registry_counters_updated_at ON public.registry_counters;
CREATE TRIGGER trg_registry_counters_updated_at BEFORE UPDATE ON public.registry_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 6. Storage bucket (private)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('registry-attachments', 'registry-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- No storage policies for authenticated — all access via service role / signed URLs from edge functions.

-- ------------------------------------------------------------
-- 7. Internal helper: PIN verify (REVOKE EXECUTE; GRANT to service_role)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._verify_registry_pin(
  _user_id uuid,
  _department_key text,
  _pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_state record;
  v_now timestamptz := now();
  v_ok boolean;
  v_max int;
  v_lock_min int;
BEGIN
  IF _pin IS NULL OR length(_pin) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_pin_format');
  END IF;

  SELECT pin_hash, pin_max_attempts, pin_lockout_minutes, is_active
    INTO v_settings
    FROM public.registry_department_settings
    WHERE department_key = _department_key;

  IF NOT FOUND OR v_settings.is_active = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'department_inactive');
  END IF;
  IF v_settings.pin_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pin_not_configured');
  END IF;

  v_max := COALESCE(v_settings.pin_max_attempts, 5);
  v_lock_min := COALESCE(v_settings.pin_lockout_minutes, 15);

  -- Ensure state row exists
  INSERT INTO public.registry_pin_state (user_id, department_key)
  VALUES (_user_id, _department_key)
  ON CONFLICT (user_id, department_key) DO NOTHING;

  SELECT * INTO v_state FROM public.registry_pin_state
    WHERE user_id = _user_id AND department_key = _department_key
    FOR UPDATE;

  IF v_state.locked_until IS NOT NULL AND v_state.locked_until > v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_state.locked_until);
  END IF;

  v_ok := (v_settings.pin_hash = crypt(_pin, v_settings.pin_hash));

  IF v_ok THEN
    UPDATE public.registry_pin_state
      SET failed_count = 0, locked_until = NULL, last_attempt_at = v_now
      WHERE user_id = _user_id AND department_key = _department_key;
    RETURN jsonb_build_object('ok', true);
  ELSE
    UPDATE public.registry_pin_state
      SET failed_count = failed_count + 1,
          last_attempt_at = v_now,
          locked_until = CASE
            WHEN failed_count + 1 >= v_max THEN v_now + make_interval(mins => v_lock_min)
            ELSE locked_until
          END
      WHERE user_id = _user_id AND department_key = _department_key
      RETURNING * INTO v_state;
    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN v_state.failed_count >= v_max THEN 'locked' ELSE 'invalid_pin' END,
      'failed_count', v_state.failed_count,
      'locked_until', v_state.locked_until
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._verify_registry_pin(uuid, text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public._verify_registry_pin(uuid, text, text) TO service_role;

-- ------------------------------------------------------------
-- 8. rotate_department_pin (super_admin or secretariat with AAL2; enforced at API)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_department_pin(
  _department_key text,
  _new_pin text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT (has_role(v_actor, 'super_admin'::app_role) OR has_role(v_actor, 'secretariat'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_pin IS NULL OR length(_new_pin) < 6 THEN
    RAISE EXCEPTION 'pin_too_short';
  END IF;

  UPDATE public.registry_department_settings
    SET pin_hash = crypt(_new_pin, gen_salt('bf', 10)),
        pin_rotated_at = now(),
        pin_rotated_by = v_actor
    WHERE department_key = _department_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'department_not_found';
  END IF;

  -- Reset all pin states for this department
  UPDATE public.registry_pin_state
    SET failed_count = 0, locked_until = NULL
    WHERE department_key = _department_key;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_pin_rotated', 'registry_department_settings', _department_key,
    jsonb_build_object('department_key', _department_key));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rotate_department_pin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_department_pin(text, text) TO authenticated;

-- ------------------------------------------------------------
-- 9. _submit_registry_request_verified (edge-only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._submit_registry_request_verified(
  _payload jsonb,
  _actor_user_id uuid,
  _actor_ip inet,
  _actor_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dept_key text := _payload->>'department_key';
  v_dept record;
  v_request_id uuid;
  v_temp_code text;
  v_is_late boolean := false;
  v_declared date := COALESCE((_payload->>'declared_registration_date')::date, CURRENT_DATE);
  v_doc_date date := NULLIF(_payload->>'document_date','')::date;
  v_is_demo boolean := COALESCE((_payload->>'is_demo')::boolean, false);
  v_seq bigint;
BEGIN
  IF _actor_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_dept_key IS NULL THEN
    RAISE EXCEPTION 'missing_department_key';
  END IF;

  SELECT * INTO v_dept FROM public.registry_department_settings
    WHERE department_key = v_dept_key AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'department_inactive_or_missing';
  END IF;

  -- Must be operator for this dept (or super_admin)
  IF NOT (has_role(_actor_user_id, 'super_admin'::app_role) OR is_registry_operator(_actor_user_id, v_dept_key)) THEN
    RAISE EXCEPTION 'not_department_operator';
  END IF;

  IF v_declared < CURRENT_DATE THEN
    v_is_late := true;
    IF COALESCE(_payload->>'late_reason','') = '' THEN
      RAISE EXCEPTION 'late_reason_required';
    END IF;
  END IF;

  -- Allocate atomic temp code per dept per year
  v_seq := nextval(pg_catalog.format('public.%I',
    'registry_tmp_seq_' || lower(regexp_replace(v_dept_key, '[^a-zA-Z0-9_]', '_', 'g'))
  ));
  v_temp_code := v_dept.draft_prefix || '/' || EXTRACT(YEAR FROM v_declared)::text || '/' || lpad(v_seq::text, 5, '0');

  INSERT INTO public.registry_requests (
    temp_code, source_department_key, submitted_by, entry_type, confidentiality,
    document_date, declared_registration_date, is_late, late_reason,
    sender, recipient, subject, content, attachments_count,
    status, is_demo, submit_ip, submit_user_agent
  ) VALUES (
    v_temp_code, v_dept_key, _actor_user_id,
    (_payload->>'entry_type')::registry_entry_type,
    COALESCE((_payload->>'confidentiality')::registry_confidentiality, 'internal_normal'),
    v_doc_date, v_declared, v_is_late, NULLIF(_payload->>'late_reason',''),
    NULLIF(_payload->>'sender',''), NULLIF(_payload->>'recipient',''),
    NULLIF(_payload->>'subject',''), NULLIF(_payload->>'content',''),
    COALESCE((_payload->>'attachments_count')::int, 0),
    'submitted'::registry_request_status, v_is_demo, _actor_ip, _actor_user_agent
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_actor_user_id, 'registry_request_submitted', 'registry_requests', v_request_id::text,
    jsonb_build_object(
      'department_key', v_dept_key,
      'temp_code', v_temp_code,
      'is_late', v_is_late,
      'is_demo', v_is_demo,
      'ip', _actor_ip::text
    ));

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._submit_registry_request_verified(jsonb, uuid, inet, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public._submit_registry_request_verified(jsonb, uuid, inet, text) TO service_role;

-- Helper to ensure per-department temp sequences exist (created lazily)
CREATE OR REPLACE FUNCTION public.ensure_registry_temp_sequence(_department_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq_name text := 'registry_tmp_seq_' || lower(regexp_replace(_department_key, '[^a-zA-Z0-9_]', '_', 'g'));
BEGIN
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I', v_seq_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_registry_temp_sequence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_registry_temp_sequence(text) TO authenticated, service_role;

-- Auto-create temp sequence on dept settings insert
CREATE OR REPLACE FUNCTION public.trg_rds_create_temp_seq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_registry_temp_sequence(NEW.department_key);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rds_temp_seq ON public.registry_department_settings;
CREATE TRIGGER trg_rds_temp_seq AFTER INSERT ON public.registry_department_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_rds_create_temp_seq();

-- ------------------------------------------------------------
-- 10. allocate_official_number — internal helper (atomic)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._allocate_official_number(
  _series_key text,
  _year integer,
  _is_demo boolean
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new bigint;
BEGIN
  INSERT INTO public.registry_counters (series_key, year, current_value, is_demo)
    VALUES (_series_key, _year, 0, _is_demo)
    ON CONFLICT (series_key, year) DO NOTHING;

  UPDATE public.registry_counters
    SET current_value = current_value + 1, updated_at = now()
    WHERE series_key = _series_key AND year = _year
    RETURNING current_value INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._allocate_official_number(text, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._allocate_official_number(text, integer, boolean) TO service_role;

-- ------------------------------------------------------------
-- 11. approve_registry_request (normal, non-restricted)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_registry_request(
  _request_id uuid,
  _override_date date DEFAULT NULL,
  _override_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req record;
  v_series text;
  v_year int;
  v_num bigint;
  v_entry_id uuid;
  v_reg_date date;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status <> 'submitted' THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_req.confidentiality = 'restricted_management' THEN
    RAISE EXCEPTION 'use_restricted_rpc';
  END IF;

  v_reg_date := COALESCE(_override_date, v_req.declared_registration_date, CURRENT_DATE);
  IF _override_date IS NOT NULL AND COALESCE(_override_reason,'') = '' THEN
    RAISE EXCEPTION 'override_reason_required';
  END IF;

  v_series := CASE WHEN v_req.is_demo THEN 'DEMO-REG' ELSE 'ICMPP-REG' END;
  v_year := EXTRACT(YEAR FROM v_reg_date)::int;

  v_num := public._allocate_official_number(v_series, v_year, v_req.is_demo);

  INSERT INTO public.registry_entries (
    series_key, year, official_number, registration_date,
    document_date, declared_registration_date, is_late, late_reason,
    entry_type, confidentiality, source_department_key,
    sender, recipient, subject, content,
    status, request_id, allocated_by, is_demo
  ) VALUES (
    v_series, v_year, v_num, v_reg_date,
    v_req.document_date, v_req.declared_registration_date, v_req.is_late, v_req.late_reason,
    v_req.entry_type, v_req.confidentiality, v_req.source_department_key,
    v_req.sender, v_req.recipient, v_req.subject, v_req.content,
    'active'::registry_entry_status, v_req.id, v_actor, v_req.is_demo
  ) RETURNING id INTO v_entry_id;

  -- Move attachments from request to entry
  UPDATE public.registry_attachments
    SET entry_id = v_entry_id
    WHERE request_id = _request_id;

  UPDATE public.registry_requests
    SET status = 'approved'::registry_request_status,
        reviewed_by = v_actor,
        reviewed_at = now(),
        approved_entry_id = v_entry_id
    WHERE id = _request_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_request_approved', 'registry_entries', v_entry_id::text,
    jsonb_build_object(
      'request_id', _request_id,
      'series_key', v_series,
      'year', v_year,
      'official_number', v_num,
      'override_date', _override_date,
      'override_reason', _override_reason
    ));

  RETURN v_entry_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_registry_request(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_registry_request(uuid, date, text) TO authenticated;

-- ------------------------------------------------------------
-- 12. approve_registry_request_restricted (blind approve for restricted_management)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_registry_request_restricted(
  _request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req record;
  v_series text;
  v_year int;
  v_num bigint;
  v_entry_id uuid;
  v_reg_date date;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.confidentiality <> 'restricted_management' THEN RAISE EXCEPTION 'not_restricted'; END IF;
  IF v_req.status <> 'submitted' THEN RAISE EXCEPTION 'invalid_status'; END IF;

  v_reg_date := COALESCE(v_req.declared_registration_date, CURRENT_DATE);
  v_series := CASE WHEN v_req.is_demo THEN 'DEMO-REG' ELSE 'ICMPP-REG' END;
  v_year := EXTRACT(YEAR FROM v_reg_date)::int;
  v_num := public._allocate_official_number(v_series, v_year, v_req.is_demo);

  INSERT INTO public.registry_entries (
    series_key, year, official_number, registration_date,
    document_date, declared_registration_date, is_late, late_reason,
    entry_type, confidentiality, source_department_key,
    sender, recipient, subject, content,
    status, request_id, allocated_by, is_demo
  ) VALUES (
    v_series, v_year, v_num, v_reg_date,
    v_req.document_date, v_req.declared_registration_date, v_req.is_late, v_req.late_reason,
    v_req.entry_type, v_req.confidentiality, v_req.source_department_key,
    v_req.sender, v_req.recipient, v_req.subject, v_req.content,
    'active'::registry_entry_status, v_req.id, v_actor, v_req.is_demo
  ) RETURNING id INTO v_entry_id;

  UPDATE public.registry_attachments SET entry_id = v_entry_id WHERE request_id = _request_id;

  UPDATE public.registry_requests
    SET status = 'approved'::registry_request_status,
        reviewed_by = v_actor,
        reviewed_at = now(),
        approved_entry_id = v_entry_id
    WHERE id = _request_id;

  -- Audit redacts subject/content for restricted
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_request_approved_restricted', 'registry_entries', v_entry_id::text,
    jsonb_build_object(
      'request_id', _request_id,
      'series_key', v_series,
      'year', v_year,
      'official_number', v_num,
      'redacted', true
    ));

  RETURN jsonb_build_object(
    'entry_id', v_entry_id,
    'series_key', v_series,
    'year', v_year,
    'official_number', v_num
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_registry_request_restricted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_registry_request_restricted(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 13. secretariat_restricted_queue — limited fields
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.secretariat_restricted_queue()
RETURNS TABLE (
  id uuid,
  temp_code text,
  entry_type registry_entry_type,
  document_date date,
  declared_registration_date date,
  is_late boolean,
  source_department_key text,
  attachments_count integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT can_manage_registry(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT r.id, r.temp_code, r.entry_type, r.document_date, r.declared_registration_date,
         r.is_late, r.source_department_key, r.attachments_count, r.created_at
  FROM public.registry_requests r
  WHERE r.confidentiality = 'restricted_management'
    AND r.status = 'submitted'
  ORDER BY r.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.secretariat_restricted_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_restricted_queue() TO authenticated;

-- ------------------------------------------------------------
-- 14. reject_registry_request
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_registry_request(
  _request_id uuid,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(_reason,'') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status <> 'submitted' THEN RAISE EXCEPTION 'invalid_status'; END IF;

  UPDATE public.registry_requests
    SET status = 'rejected'::registry_request_status,
        rejection_reason = _reason,
        reviewed_by = v_actor,
        reviewed_at = now()
    WHERE id = _request_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_request_rejected', 'registry_requests', _request_id::text,
    jsonb_build_object('reason', _reason, 'was_restricted', v_req.confidentiality = 'restricted_management'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_registry_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_registry_request(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 15. cancel_registry_entry — keeps number reserved
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_registry_entry(
  _entry_id uuid,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_entry record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(_reason,'') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO v_entry FROM public.registry_entries WHERE id = _entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_found'; END IF;
  IF v_entry.status = 'cancelled' THEN RAISE EXCEPTION 'already_cancelled'; END IF;

  UPDATE public.registry_entries
    SET status = 'cancelled'::registry_entry_status,
        cancellation_reason = _reason,
        cancelled_by = v_actor,
        cancelled_at = now()
    WHERE id = _entry_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_entry_cancelled', 'registry_entries', _entry_id::text,
    jsonb_build_object(
      'reason', _reason,
      'series_key', v_entry.series_key,
      'year', v_entry.year,
      'official_number', v_entry.official_number,
      'note', 'number_remains_reserved'
    ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_registry_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_registry_entry(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 16. assign_registry_entry
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_registry_entry(
  _entry_id uuid,
  _department_key text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _due_date date DEFAULT NULL,
  _instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _department_key IS NULL AND _user_id IS NULL THEN RAISE EXCEPTION 'target_required'; END IF;

  INSERT INTO public.registry_assignments (
    entry_id, assigned_department_key, assigned_user_id, due_date, instructions, assigned_by
  ) VALUES (
    _entry_id, _department_key, _user_id, _due_date, _instructions, v_actor
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_entry_assigned', 'registry_assignments', v_id::text,
    jsonb_build_object('entry_id', _entry_id, 'dept', _department_key, 'user', _user_id, 'due', _due_date));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_registry_entry(uuid, text, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_registry_entry(uuid, text, uuid, date, text) TO authenticated;

-- ------------------------------------------------------------
-- 17. link_registry_entries
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_registry_entries(
  _from_entry_id uuid,
  _to_entry_id uuid,
  _link_type text DEFAULT 'related'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _from_entry_id = _to_entry_id THEN RAISE EXCEPTION 'self_link_forbidden'; END IF;

  INSERT INTO public.registry_entry_links (from_entry_id, to_entry_id, link_type, created_by)
  VALUES (_from_entry_id, _to_entry_id, _link_type, v_actor)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_entries_linked', 'registry_entry_links', v_id::text,
    jsonb_build_object('from', _from_entry_id, 'to', _to_entry_id, 'type', _link_type));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_registry_entries(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_registry_entries(uuid, uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 18. verify_counter_integrity — list gaps in numbering
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_counter_integrity(
  _series_key text,
  _year integer
)
RETURNS TABLE (missing_number bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_max bigint;
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR can_manage_registry(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT current_value INTO v_max FROM public.registry_counters
    WHERE series_key = _series_key AND year = _year;
  IF v_max IS NULL OR v_max = 0 THEN RETURN; END IF;

  RETURN QUERY
  SELECT g.n::bigint
  FROM generate_series(1, v_max) AS g(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.registry_entries e
    WHERE e.series_key = _series_key AND e.year = _year AND e.official_number = g.n
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_counter_integrity(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_counter_integrity(text, integer) TO authenticated;

-- ------------------------------------------------------------
-- 19. Internal: _register_attachment_verified (edge-only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._register_attachment_verified(
  _request_id uuid,
  _storage_path text,
  _file_name text,
  _mime_type text,
  _size_bytes bigint,
  _actor_user_id uuid,
  _is_demo boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_req record;
BEGIN
  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status NOT IN ('draft','submitted') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_req.submitted_by IS DISTINCT FROM _actor_user_id
     AND NOT has_role(_actor_user_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.registry_attachments (
    request_id, bucket, storage_path, file_name, mime_type, size_bytes, uploaded_by, is_demo
  ) VALUES (
    _request_id, 'registry-attachments', _storage_path, _file_name, _mime_type, _size_bytes, _actor_user_id, _is_demo
  ) RETURNING id INTO v_id;

  UPDATE public.registry_requests
    SET attachments_count = attachments_count + 1
    WHERE id = _request_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._register_attachment_verified(uuid, text, text, text, bigint, uuid, boolean) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public._register_attachment_verified(uuid, text, text, text, bigint, uuid, boolean) TO service_role;

-- ------------------------------------------------------------
-- 20. _delete_attachment_verified (edge-only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._delete_attachment_verified(
  _attachment_id uuid,
  _actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att record;
  v_req record;
BEGIN
  SELECT * INTO v_att FROM public.registry_attachments WHERE id = _attachment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'attachment_not_found'; END IF;
  IF v_att.entry_id IS NOT NULL THEN RAISE EXCEPTION 'attached_to_entry_immutable'; END IF;

  SELECT * INTO v_req FROM public.registry_requests WHERE id = v_att.request_id;
  IF v_req.status NOT IN ('draft','submitted') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_req.submitted_by IS DISTINCT FROM _actor_user_id
     AND NOT has_role(_actor_user_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.registry_attachments WHERE id = _attachment_id;
  UPDATE public.registry_requests
    SET attachments_count = GREATEST(attachments_count - 1, 0)
    WHERE id = v_att.request_id;

  RETURN jsonb_build_object('bucket', v_att.bucket, 'storage_path', v_att.storage_path);
END;
$$;

REVOKE EXECUTE ON FUNCTION public._delete_attachment_verified(uuid, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public._delete_attachment_verified(uuid, uuid) TO service_role;

-- ------------------------------------------------------------
-- 21. report_orphan_storage (edge-only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._report_orphan_storage(
  _bucket text,
  _storage_path text,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.registry_orphan_storage (bucket, storage_path, failure_reason)
  VALUES (_bucket, _storage_path, _reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._report_orphan_storage(text, text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public._report_orphan_storage(text, text, text) TO service_role;
