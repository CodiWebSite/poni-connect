CREATE TABLE public.doctoral_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  doctoral_school text,
  thesis_title text,
  study_year integer,
  start_date date,
  expected_completion_date date,
  coordinator_user_id uuid,
  coordinator_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','changes_requested','rejected','completed','withdrawn','suspended')),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.doctoral_profiles TO authenticated;
GRANT ALL ON public.doctoral_profiles TO service_role;
ALTER TABLE public.doctoral_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_doctoral(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','hr','sef_srus','director_institut','director_adjunct','secretar_stiintific')
  )
$$;

CREATE POLICY "Doctorands view own profile" ON public.doctoral_profiles
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Doctorands update own pending profile" ON public.doctoral_profiles
FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status IN ('pending','changes_requested'))
WITH CHECK (user_id = auth.uid() AND status IN ('pending','changes_requested'));
CREATE POLICY "Coordinators view assigned profiles" ON public.doctoral_profiles
FOR SELECT TO authenticated USING (coordinator_user_id = auth.uid());
CREATE POLICY "Doctoral managers manage profiles" ON public.doctoral_profiles
FOR ALL TO authenticated USING (public.can_manage_doctoral(auth.uid())) WITH CHECK (public.can_manage_doctoral(auth.uid()));

CREATE TABLE public.doctoral_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctoral_profile_id uuid NOT NULL REFERENCES public.doctoral_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','changes_requested','overdue')),
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctoral_milestones TO authenticated;
GRANT ALL ON public.doctoral_milestones TO service_role;
ALTER TABLE public.doctoral_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctoral participants view milestones" ON public.doctoral_milestones
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND (p.user_id = auth.uid() OR p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))));
CREATE POLICY "Doctorands update own milestones" ON public.doctoral_milestones
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Coordinators manage milestones" ON public.doctoral_milestones
FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND (p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND (p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))));

CREATE TABLE public.doctoral_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctoral_profile_id uuid NOT NULL REFERENCES public.doctoral_profiles(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.doctoral_milestones(id) ON DELETE SET NULL,
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'other',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','changes_requested','rejected')),
  review_notes text,
  uploaded_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctoral_documents TO authenticated;
GRANT ALL ON public.doctoral_documents TO service_role;
ALTER TABLE public.doctoral_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctoral participants view documents" ON public.doctoral_documents
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND (p.user_id = auth.uid() OR p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))));
CREATE POLICY "Doctorands upload own documents" ON public.doctoral_documents
FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND p.user_id = auth.uid() AND p.status = 'active'));
CREATE POLICY "Doctorands update own documents" ON public.doctoral_documents
FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() AND status IN ('submitted','changes_requested'))
WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Doctoral reviewers manage documents" ON public.doctoral_documents
FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND (p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND (p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))));

CREATE TABLE public.doctoral_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctoral_profile_id uuid NOT NULL REFERENCES public.doctoral_profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared','management')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctoral_notes TO authenticated;
GRANT ALL ON public.doctoral_notes TO service_role;
ALTER TABLE public.doctoral_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctoral participants view shared notes" ON public.doctoral_notes
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND ((visibility = 'shared' AND (p.user_id = auth.uid() OR p.coordinator_user_id = auth.uid())) OR public.can_manage_doctoral(auth.uid()))));
CREATE POLICY "Coordinators add notes" ON public.doctoral_notes
FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.doctoral_profiles p WHERE p.id = doctoral_profile_id AND (p.coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()))));
CREATE POLICY "Authors manage notes" ON public.doctoral_notes
FOR UPDATE TO authenticated USING (author_id = auth.uid() OR public.can_manage_doctoral(auth.uid())) WITH CHECK (author_id = auth.uid() OR public.can_manage_doctoral(auth.uid()));
CREATE POLICY "Authors delete notes" ON public.doctoral_notes
FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.can_manage_doctoral(auth.uid()));

CREATE INDEX doctoral_profiles_status_idx ON public.doctoral_profiles(status);
CREATE INDEX doctoral_profiles_coordinator_idx ON public.doctoral_profiles(coordinator_user_id);
CREATE INDEX doctoral_milestones_profile_due_idx ON public.doctoral_milestones(doctoral_profile_id, due_date);
CREATE INDEX doctoral_documents_profile_idx ON public.doctoral_documents(doctoral_profile_id);

CREATE OR REPLACE FUNCTION public.review_doctoral_application(_profile_id uuid, _decision text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT public.can_manage_doctoral(auth.uid()) THEN RAISE EXCEPTION 'Acces interzis'; END IF;
  IF _decision NOT IN ('active','changes_requested','rejected','suspended','completed','withdrawn') THEN RAISE EXCEPTION 'Decizie invalidă'; END IF;
  SELECT user_id INTO v_user_id FROM public.doctoral_profiles WHERE id = _profile_id FOR UPDATE;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Cererea nu există'; END IF;
  UPDATE public.doctoral_profiles SET status = _decision, admin_notes = _notes, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = _profile_id;
  IF _decision = 'active' THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id AND role IN ('user','doctorand_pending');
    INSERT INTO public.user_roles(user_id, role) VALUES (v_user_id, 'doctorand') ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.notifications(user_id,title,message,type,related_type,related_id) VALUES (v_user_id,'Cererea a fost aprobată','Contul tău de doctorand este activ. Bun venit în Spațiul Doctoral!','success','doctoral_profile',_profile_id);
  ELSIF _decision IN ('rejected','suspended','withdrawn') THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'doctorand';
    INSERT INTO public.user_roles(user_id, role) VALUES (v_user_id, 'doctorand_pending') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_doctoral_application(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE pre_role app_role; assigned_role app_role; role_label text; account_kind text;
BEGIN
  account_kind := COALESCE(new.raw_user_meta_data ->> 'account_type', 'employee');
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email), NULLIF(new.raw_user_meta_data ->> 'phone',''));
  SELECT role INTO pre_role FROM public.pre_assigned_roles WHERE LOWER(email) = LOWER(new.email) LIMIT 1;
  assigned_role := COALESCE(pre_role, CASE WHEN account_kind = 'doctorand' THEN 'doctorand_pending'::app_role ELSE 'user'::app_role END);
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, assigned_role);
  IF account_kind = 'doctorand' AND pre_role IS NULL THEN
    INSERT INTO public.doctoral_profiles(user_id,email,full_name,phone,doctoral_school,thesis_title,study_year,start_date,expected_completion_date,coordinator_name,status)
    VALUES (new.id,lower(new.email),COALESCE(new.raw_user_meta_data ->> 'full_name',new.email),NULLIF(new.raw_user_meta_data ->> 'phone',''),NULLIF(new.raw_user_meta_data ->> 'doctoral_school',''),NULLIF(new.raw_user_meta_data ->> 'thesis_title',''),NULLIF(new.raw_user_meta_data ->> 'study_year','')::integer,NULLIF(new.raw_user_meta_data ->> 'start_date','')::date,NULLIF(new.raw_user_meta_data ->> 'expected_completion_date','')::date,NULLIF(new.raw_user_meta_data ->> 'coordinator_name',''),'pending');
    INSERT INTO public.notifications(user_id,title,message,type,related_type) SELECT user_id,'Cerere nouă de doctorand',COALESCE(new.raw_user_meta_data ->> 'full_name',new.email)||' solicită acces în Spațiul Doctoral.','warning','doctoral_application' FROM public.user_roles WHERE role IN ('super_admin','hr','sef_srus');
  ELSIF pre_role IS NOT NULL THEN
    role_label := CASE pre_role::text WHEN 'super_admin' THEN 'Super Admin' WHEN 'director_institut' THEN 'Director' WHEN 'director_adjunct' THEN 'Director Adjunct' WHEN 'secretar_stiintific' THEN 'Secretar Științific' WHEN 'sef_srus' THEN 'Șef Serviciu Resurse Umane' WHEN 'sef' THEN 'Șef Departament' WHEN 'hr' THEN 'HR (SRUS)' WHEN 'secretariat' THEN 'Secretariat' WHEN 'salarizare' THEN 'Salarizare' WHEN 'bibliotecar' THEN 'Bibliotecar' WHEN 'achizitii' THEN 'Achiziții' WHEN 'contabilitate' THEN 'Contabilitate' WHEN 'oficiu_juridic' THEN 'Oficiu Juridic' WHEN 'compartiment_comunicare' THEN 'Compartiment Comunicare' WHEN 'medic_medicina_muncii' THEN 'Medic Medicina Muncii' WHEN 'doctorand' THEN 'Doctorand' ELSE 'Angajat' END;
    INSERT INTO public.notifications(user_id,title,message,type) VALUES(new.id,'Rol pre-atribuit aplicat','Bine ai venit! Ți-a fost atribuit rolul de '||role_label||'.','success');
    DELETE FROM public.pre_assigned_roles WHERE LOWER(email)=LOWER(new.email);
  END IF;
  RETURN new;
END;
$$;