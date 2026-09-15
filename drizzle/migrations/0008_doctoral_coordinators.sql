CREATE TABLE public.doctoral_coordinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  academic_title text,
  doctoral_school text,
  research_field text,
  email text,
  max_students integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX doctoral_coordinators_user_id_key ON public.doctoral_coordinators (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX doctoral_coordinators_active_idx ON public.doctoral_coordinators (is_active);

GRANT SELECT ON public.doctoral_coordinators TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctoral_coordinators TO authenticated;
GRANT ALL ON public.doctoral_coordinators TO service_role;

ALTER TABLE public.doctoral_coordinators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active coordinators are listable"
ON public.doctoral_coordinators FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Doctoral managers manage coordinators"
ON public.doctoral_coordinators FOR ALL
TO authenticated
USING (public.can_manage_doctoral(auth.uid()))
WITH CHECK (public.can_manage_doctoral(auth.uid()));

CREATE TRIGGER doctoral_coordinators_touch
BEFORE UPDATE ON public.doctoral_coordinators
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_doctoral_coordinator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctoral_coordinators
    WHERE user_id = _user_id AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.doctoral_profiles WHERE coordinator_user_id = _user_id
  )
$$;

CREATE POLICY "Coordinators update assigned profiles"
ON public.doctoral_profiles FOR UPDATE
TO authenticated
USING (coordinator_user_id = auth.uid())
WITH CHECK (coordinator_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE pre_role app_role; assigned_role app_role; role_label text; account_kind text; coord_id uuid; coord_user uuid; coord_label text;
BEGIN
  account_kind := COALESCE(new.raw_user_meta_data ->> 'account_type', 'employee');
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email), NULLIF(new.raw_user_meta_data ->> 'phone',''));
  SELECT role INTO pre_role FROM public.pre_assigned_roles WHERE LOWER(email) = LOWER(new.email) LIMIT 1;
  assigned_role := COALESCE(pre_role, CASE WHEN account_kind = 'doctorand' THEN 'doctorand_pending'::app_role ELSE 'user'::app_role END);
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, assigned_role);
  IF account_kind = 'doctorand' AND pre_role IS NULL THEN
    coord_id := NULLIF(new.raw_user_meta_data ->> 'coordinator_id','')::uuid;
    coord_label := NULLIF(new.raw_user_meta_data ->> 'coordinator_name','');
    IF coord_id IS NOT NULL THEN
      SELECT user_id, full_name INTO coord_user, coord_label FROM public.doctoral_coordinators WHERE id = coord_id;
      coord_label := COALESCE(coord_label, NULLIF(new.raw_user_meta_data ->> 'coordinator_name',''));
    END IF;
    INSERT INTO public.doctoral_profiles(user_id,email,full_name,phone,doctoral_school,thesis_title,study_year,start_date,expected_completion_date,coordinator_name,coordinator_user_id,status)
    VALUES (new.id,lower(new.email),COALESCE(new.raw_user_meta_data ->> 'full_name',new.email),NULLIF(new.raw_user_meta_data ->> 'phone',''),NULLIF(new.raw_user_meta_data ->> 'doctoral_school',''),NULLIF(new.raw_user_meta_data ->> 'thesis_title',''),NULLIF(new.raw_user_meta_data ->> 'study_year','')::integer,NULLIF(new.raw_user_meta_data ->> 'start_date','')::date,NULLIF(new.raw_user_meta_data ->> 'expected_completion_date','')::date,coord_label,coord_user,'pending');
    INSERT INTO public.notifications(user_id,title,message,type,related_type) SELECT user_id,'Cerere nouă de doctorand',COALESCE(new.raw_user_meta_data ->> 'full_name',new.email)||' solicită acces în Spațiul Doctoral.','warning','doctoral_application' FROM public.user_roles WHERE role IN ('super_admin','hr','sef_srus');
    IF coord_user IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,title,message,type,related_type)
      VALUES (coord_user,'Doctorand nou te-a indicat ca conducător',COALESCE(new.raw_user_meta_data ->> 'full_name',new.email)||' s-a înregistrat în Spațiul Doctoral și te-a selectat ca conducător de doctorat.','info','doctoral_application');
    END IF;
  ELSIF pre_role IS NOT NULL THEN
    role_label := CASE pre_role::text WHEN 'super_admin' THEN 'Super Admin' WHEN 'director_institut' THEN 'Director' WHEN 'director_adjunct' THEN 'Director Adjunct' WHEN 'secretar_stiintific' THEN 'Secretar Științific' WHEN 'sef_srus' THEN 'Șef Serviciu Resurse Umane' WHEN 'sef' THEN 'Șef Departament' WHEN 'hr' THEN 'HR (SRUS)' WHEN 'secretariat' THEN 'Secretariat' WHEN 'salarizare' THEN 'Salarizare' WHEN 'bibliotecar' THEN 'Bibliotecar' WHEN 'achizitii' THEN 'Achiziții' WHEN 'contabilitate' THEN 'Contabilitate' WHEN 'oficiu_juridic' THEN 'Oficiu Juridic' WHEN 'compartiment_comunicare' THEN 'Compartiment Comunicare' WHEN 'medic_medicina_muncii' THEN 'Medic Medicina Muncii' WHEN 'doctorand' THEN 'Doctorand' ELSE 'Angajat' END;
    INSERT INTO public.notifications(user_id,title,message,type) VALUES(new.id,'Rol pre-atribuit aplicat','Bine ai venit! Ți-a fost atribuit rolul de '||role_label||'.','success');
    DELETE FROM public.pre_assigned_roles WHERE LOWER(email)=LOWER(new.email);
  END IF;
  RETURN new;
END;
$function$;