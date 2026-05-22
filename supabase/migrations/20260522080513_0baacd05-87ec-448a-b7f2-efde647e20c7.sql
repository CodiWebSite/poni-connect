-- Fix registry RPCs: align enum values with actual DB enum (submitted_to_secretariat / approved_registered)
CREATE OR REPLACE FUNCTION public._submit_registry_request_verified(
  _payload jsonb, _actor_user_id uuid, _actor_ip inet, _actor_user_agent text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF _actor_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_dept_key IS NULL THEN RAISE EXCEPTION 'missing_department_key'; END IF;
  SELECT * INTO v_dept FROM public.registry_department_settings WHERE department_key = v_dept_key AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'department_inactive_or_missing'; END IF;
  IF NOT (has_role(_actor_user_id, 'super_admin'::app_role) OR is_registry_operator(_actor_user_id, v_dept_key)) THEN
    RAISE EXCEPTION 'not_department_operator';
  END IF;
  IF v_declared < CURRENT_DATE THEN
    v_is_late := true;
    IF COALESCE(_payload->>'late_reason','') = '' THEN RAISE EXCEPTION 'late_reason_required'; END IF;
  END IF;
  v_seq := nextval(pg_catalog.format('public.%I',
    'registry_tmp_seq_' || lower(regexp_replace(v_dept_key, '[^a-zA-Z0-9_]', '_', 'g'))));
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
    'submitted_to_secretariat'::registry_request_status, v_is_demo, _actor_ip, _actor_user_agent
  ) RETURNING id INTO v_request_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_actor_user_id, 'registry_request_submitted', 'registry_requests', v_request_id::text,
    jsonb_build_object('department_key', v_dept_key, 'temp_code', v_temp_code,
      'is_late', v_is_late, 'is_demo', v_is_demo, 'ip', _actor_ip::text));
  RETURN v_request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_registry_request(
  _request_id uuid, _override_date date DEFAULT NULL, _override_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid(); v_req record; v_series text; v_year int; v_num bigint; v_entry_id uuid; v_reg_date date;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status <> 'submitted_to_secretariat' THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_req.confidentiality = 'restricted_management' THEN RAISE EXCEPTION 'use_restricted_rpc'; END IF;
  v_reg_date := COALESCE(_override_date, v_req.declared_registration_date, CURRENT_DATE);
  IF _override_date IS NOT NULL AND COALESCE(_override_reason,'') = '' THEN RAISE EXCEPTION 'override_reason_required'; END IF;
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
    SET status = 'approved_registered'::registry_request_status,
        reviewed_by = v_actor, reviewed_at = now(), approved_entry_id = v_entry_id
    WHERE id = _request_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_request_approved', 'registry_entries', v_entry_id::text,
    jsonb_build_object('request_id', _request_id, 'series_key', v_series, 'year', v_year,
      'official_number', v_num, 'override_date', _override_date, 'override_reason', _override_reason));
  RETURN v_entry_id;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_registry_request_restricted(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid(); v_req record; v_series text; v_year int; v_num bigint; v_entry_id uuid; v_reg_date date;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.confidentiality <> 'restricted_management' THEN RAISE EXCEPTION 'not_restricted'; END IF;
  IF v_req.status <> 'submitted_to_secretariat' THEN RAISE EXCEPTION 'invalid_status'; END IF;
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
    SET status = 'approved_registered'::registry_request_status,
        reviewed_by = v_actor, reviewed_at = now(), approved_entry_id = v_entry_id
    WHERE id = _request_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_request_approved_restricted', 'registry_entries', v_entry_id::text,
    jsonb_build_object('request_id', _request_id, 'series_key', v_series, 'year', v_year,
      'official_number', v_num, 'redacted', true));
  RETURN jsonb_build_object('entry_id', v_entry_id, 'series_key', v_series, 'year', v_year, 'official_number', v_num);
END; $$;

CREATE OR REPLACE FUNCTION public.secretariat_restricted_queue()
RETURNS TABLE (id uuid, temp_code text, entry_type registry_entry_type, document_date date,
  declared_registration_date date, is_late boolean, source_department_key text,
  attachments_count integer, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  IF NOT can_manage_registry(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT r.id, r.temp_code, r.entry_type, r.document_date, r.declared_registration_date,
         r.is_late, r.source_department_key, r.attachments_count, r.created_at
  FROM public.registry_requests r
  WHERE r.confidentiality = 'restricted_management' AND r.status = 'submitted_to_secretariat'
  ORDER BY r.created_at ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_registry_request(_request_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_req record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT can_manage_registry(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(_reason,'') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status <> 'submitted_to_secretariat' THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.registry_requests
    SET status = 'rejected'::registry_request_status, rejection_reason = _reason,
        reviewed_by = v_actor, reviewed_at = now()
    WHERE id = _request_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'registry_request_rejected', 'registry_requests', _request_id::text,
    jsonb_build_object('reason', _reason, 'was_restricted', v_req.confidentiality = 'restricted_management'));
END; $$;

CREATE OR REPLACE FUNCTION public._register_attachment_verified(
  _request_id uuid, _storage_path text, _file_name text, _mime_type text,
  _size_bytes bigint, _actor_user_id uuid, _is_demo boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_req record;
BEGIN
  SELECT * INTO v_req FROM public.registry_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status NOT IN ('draft','submitted_to_secretariat') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_req.submitted_by IS DISTINCT FROM _actor_user_id
     AND NOT has_role(_actor_user_id, 'super_admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.registry_attachments (
    request_id, bucket, storage_path, file_name, mime_type, size_bytes, uploaded_by, is_demo
  ) VALUES (
    _request_id, 'registry-attachments', _storage_path, _file_name, _mime_type, _size_bytes, _actor_user_id, _is_demo
  ) RETURNING id INTO v_id;
  UPDATE public.registry_requests SET attachments_count = attachments_count + 1 WHERE id = _request_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public._delete_attachment_verified(_attachment_id uuid, _actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_att record; v_req record;
BEGIN
  SELECT * INTO v_att FROM public.registry_attachments WHERE id = _attachment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'attachment_not_found'; END IF;
  IF v_att.entry_id IS NOT NULL THEN RAISE EXCEPTION 'attached_to_entry_immutable'; END IF;
  SELECT * INTO v_req FROM public.registry_requests WHERE id = v_att.request_id;
  IF v_req.status NOT IN ('draft','submitted_to_secretariat') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_req.submitted_by IS DISTINCT FROM _actor_user_id
     AND NOT has_role(_actor_user_id, 'super_admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.registry_attachments WHERE id = _attachment_id;
  UPDATE public.registry_requests SET attachments_count = GREATEST(attachments_count - 1, 0) WHERE id = v_att.request_id;
  RETURN jsonb_build_object('bucket', v_att.bucket, 'storage_path', v_att.storage_path);
END; $$;