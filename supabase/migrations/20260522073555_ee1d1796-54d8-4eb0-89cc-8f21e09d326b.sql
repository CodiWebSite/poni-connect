
-- ============================================================================
-- BATCH 2 — Secretariat Digital ICMPP
-- ============================================================================

-- 0. CORECȚIE Batch 1: Restrânge SELECT pe registry_department_operators
DROP POLICY IF EXISTS "registry_department_operators_select_authenticated" ON public.registry_department_operators;
DROP POLICY IF EXISTS "Authenticated can view operators" ON public.registry_department_operators;
DROP POLICY IF EXISTS "registry_dept_operators_select_auth" ON public.registry_department_operators;

CREATE POLICY "registry_operators_select_super_admin"
  ON public.registry_department_operators FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "registry_operators_select_self_active"
  ON public.registry_department_operators FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

-- 1. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_registry_dept_key(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rds.department_key
  FROM public.profiles p
  JOIN public.registry_department_settings rds
    ON LOWER(TRIM(rds.profile_department_value)) = LOWER(TRIM(p.department))
  WHERE p.user_id = _user_id AND rds.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_registry_operator(_user_id uuid, _department_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registry_department_operators
    WHERE user_id = _user_id AND department_key = _department_key AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_restricted_management(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin'::app_role, 'director_institut'::app_role, 'director_adjunct'::app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_registry(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin'::app_role, 'secretariat'::app_role)
  );
$$;

-- 2. registry_requests
CREATE TABLE public.registry_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temp_code text NOT NULL,
  source_department_key text NOT NULL REFERENCES public.registry_department_settings(department_key) ON DELETE RESTRICT,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_type public.registry_entry_type NOT NULL,
  confidentiality public.registry_confidentiality NOT NULL DEFAULT 'internal_normal',
  document_date date,
  declared_registration_date date NOT NULL DEFAULT CURRENT_DATE,
  is_late boolean NOT NULL DEFAULT false,
  late_reason text,
  sender text,
  recipient text,
  subject text,
  content text,
  attachments_count integer NOT NULL DEFAULT 0,
  status public.registry_request_status NOT NULL DEFAULT 'draft',
  rejection_reason text,
  cancellation_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_entry_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  submit_ip inet,
  submit_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_registry_requests_dept ON public.registry_requests(source_department_key);
CREATE INDEX idx_registry_requests_status ON public.registry_requests(status);
CREATE INDEX idx_registry_requests_submitted_by ON public.registry_requests(submitted_by);
CREATE INDEX idx_registry_requests_is_demo ON public.registry_requests(is_demo);
CREATE INDEX idx_registry_requests_created_at ON public.registry_requests(created_at DESC);

CREATE TRIGGER trg_registry_requests_updated_at
  BEFORE UPDATE ON public.registry_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.registry_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registry_requests_select_super_admin"
  ON public.registry_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "registry_requests_select_secretariat_non_restricted"
  ON public.registry_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretariat') AND confidentiality <> 'restricted_management');

CREATE POLICY "registry_requests_select_leadership_restricted"
  ON public.registry_requests FOR SELECT TO authenticated
  USING (confidentiality = 'restricted_management' AND public.can_view_restricted_management(auth.uid()));

CREATE POLICY "registry_requests_select_own"
  ON public.registry_requests FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() AND confidentiality <> 'restricted_management');

CREATE POLICY "registry_requests_select_dept_operator"
  ON public.registry_requests FOR SELECT TO authenticated
  USING (confidentiality <> 'restricted_management' AND public.is_registry_operator(auth.uid(), source_department_key));

CREATE POLICY "registry_requests_insert_blocked"
  ON public.registry_requests FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "registry_requests_update_blocked"
  ON public.registry_requests FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "registry_requests_delete_blocked"
  ON public.registry_requests FOR DELETE TO authenticated USING (false);

-- 3. registry_entries
CREATE TABLE public.registry_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_key text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2999),
  official_number integer NOT NULL CHECK (official_number > 0),
  registration_date date NOT NULL DEFAULT CURRENT_DATE,
  document_date date,
  declared_registration_date date,
  is_late boolean NOT NULL DEFAULT false,
  late_reason text,
  entry_type public.registry_entry_type NOT NULL,
  confidentiality public.registry_confidentiality NOT NULL DEFAULT 'internal_normal',
  source_department_key text REFERENCES public.registry_department_settings(department_key) ON DELETE SET NULL,
  sender text,
  recipient text,
  subject text,
  content text,
  status public.registry_entry_status NOT NULL DEFAULT 'active',
  cancellation_reason text,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  request_id uuid REFERENCES public.registry_requests(id) ON DELETE RESTRICT,
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registry_entries_official_unique UNIQUE (series_key, year, official_number)
);

CREATE INDEX idx_registry_entries_year_number ON public.registry_entries(year, official_number);
CREATE INDEX idx_registry_entries_dept ON public.registry_entries(source_department_key);
CREATE INDEX idx_registry_entries_type ON public.registry_entries(entry_type);
CREATE INDEX idx_registry_entries_status ON public.registry_entries(status);
CREATE INDEX idx_registry_entries_is_demo ON public.registry_entries(is_demo);
CREATE INDEX idx_registry_entries_request ON public.registry_entries(request_id);
CREATE INDEX idx_registry_entries_registration_date ON public.registry_entries(registration_date DESC);

ALTER TABLE public.registry_requests
  ADD CONSTRAINT registry_requests_approved_entry_fk
  FOREIGN KEY (approved_entry_id) REFERENCES public.registry_entries(id) ON DELETE SET NULL;

CREATE TRIGGER trg_registry_entries_updated_at
  BEFORE UPDATE ON public.registry_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.registry_entries_protect_official_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allow text;
BEGIN
  BEGIN
    v_allow := current_setting('app.registry_allow_official_change', true);
  EXCEPTION WHEN OTHERS THEN
    v_allow := NULL;
  END;

  IF v_allow = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.official_number IS DISTINCT FROM OLD.official_number
     OR NEW.year IS DISTINCT FROM OLD.year
     OR NEW.series_key IS DISTINCT FROM OLD.series_key
     OR NEW.registration_date IS DISTINCT FROM OLD.registration_date
     OR NEW.entry_type IS DISTINCT FROM OLD.entry_type
     OR NEW.is_demo IS DISTINCT FROM OLD.is_demo
  THEN
    RAISE EXCEPTION 'registry_entries: official fields are immutable after allocation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registry_entries_immutable_official
  BEFORE UPDATE ON public.registry_entries
  FOR EACH ROW EXECUTE FUNCTION public.registry_entries_protect_official_fields();

ALTER TABLE public.registry_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registry_entries_select_super_admin"
  ON public.registry_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "registry_entries_select_secretariat_non_restricted"
  ON public.registry_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretariat') AND confidentiality <> 'restricted_management');

CREATE POLICY "registry_entries_select_leadership_restricted"
  ON public.registry_entries FOR SELECT TO authenticated
  USING (confidentiality = 'restricted_management' AND public.can_view_restricted_management(auth.uid()));

CREATE POLICY "registry_entries_select_dept_operator"
  ON public.registry_entries FOR SELECT TO authenticated
  USING (
    confidentiality <> 'restricted_management'
    AND source_department_key IS NOT NULL
    AND public.is_registry_operator(auth.uid(), source_department_key)
  );

CREATE POLICY "registry_entries_select_same_dept"
  ON public.registry_entries FOR SELECT TO authenticated
  USING (
    confidentiality <> 'restricted_management'
    AND source_department_key IS NOT NULL
    AND public.get_user_registry_dept_key(auth.uid()) = source_department_key
  );

CREATE POLICY "registry_entries_insert_blocked"
  ON public.registry_entries FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "registry_entries_update_blocked"
  ON public.registry_entries FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "registry_entries_delete_blocked"
  ON public.registry_entries FOR DELETE TO authenticated USING (false);

-- 4. registry_assignments
CREATE TABLE public.registry_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.registry_entries(id) ON DELETE CASCADE,
  assigned_department_key text REFERENCES public.registry_department_settings(department_key) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  instructions text,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registry_assignments_target_check
    CHECK (assigned_department_key IS NOT NULL OR assigned_user_id IS NOT NULL)
);

CREATE INDEX idx_registry_assignments_entry ON public.registry_assignments(entry_id);
CREATE INDEX idx_registry_assignments_dept ON public.registry_assignments(assigned_department_key);
CREATE INDEX idx_registry_assignments_user ON public.registry_assignments(assigned_user_id);
CREATE INDEX idx_registry_assignments_active ON public.registry_assignments(is_active);

CREATE TRIGGER trg_registry_assignments_updated_at
  BEFORE UPDATE ON public.registry_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.registry_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registry_assignments_select_super_admin"
  ON public.registry_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "registry_assignments_select_secretariat"
  ON public.registry_assignments FOR SELECT TO authenticated
  USING (public.can_manage_registry(auth.uid()));

CREATE POLICY "registry_assignments_select_assigned_user"
  ON public.registry_assignments FOR SELECT TO authenticated
  USING (assigned_user_id = auth.uid());

CREATE POLICY "registry_assignments_select_assigned_dept"
  ON public.registry_assignments FOR SELECT TO authenticated
  USING (
    assigned_department_key IS NOT NULL
    AND public.get_user_registry_dept_key(auth.uid()) = assigned_department_key
  );

CREATE POLICY "registry_assignments_insert_blocked"
  ON public.registry_assignments FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "registry_assignments_update_blocked"
  ON public.registry_assignments FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "registry_assignments_delete_blocked"
  ON public.registry_assignments FOR DELETE TO authenticated USING (false);

-- 5. registry_entry_links
CREATE TABLE public.registry_entry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entry_id uuid NOT NULL REFERENCES public.registry_entries(id) ON DELETE CASCADE,
  to_entry_id uuid NOT NULL REFERENCES public.registry_entries(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'reply',
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registry_entry_links_no_self CHECK (from_entry_id <> to_entry_id),
  CONSTRAINT registry_entry_links_unique UNIQUE (from_entry_id, to_entry_id, link_type)
);

CREATE INDEX idx_registry_entry_links_from ON public.registry_entry_links(from_entry_id);
CREATE INDEX idx_registry_entry_links_to ON public.registry_entry_links(to_entry_id);

ALTER TABLE public.registry_entry_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registry_entry_links_select_super_admin"
  ON public.registry_entry_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "registry_entry_links_select_secretariat"
  ON public.registry_entry_links FOR SELECT TO authenticated
  USING (public.can_manage_registry(auth.uid()));

CREATE POLICY "registry_entry_links_insert_blocked"
  ON public.registry_entry_links FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "registry_entry_links_update_blocked"
  ON public.registry_entry_links FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "registry_entry_links_delete_blocked"
  ON public.registry_entry_links FOR DELETE TO authenticated USING (false);
