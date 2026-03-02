
-- Function using text cast to avoid enum validation issue
CREATE OR REPLACE FUNCTION public.can_manage_salarizare(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'salarizare'
  )
$$;

-- RLS policies for salarizare role
CREATE POLICY "Salarizare can view EPD"
ON public.employee_personal_data FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

CREATE POLICY "Salarizare can view leave requests"
ON public.leave_requests FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

CREATE POLICY "Salarizare can view employee records"
ON public.employee_records FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

CREATE POLICY "Salarizare can view leave carryover"
ON public.leave_carryover FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

CREATE POLICY "Salarizare can view leave bonus"
ON public.leave_bonus FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

CREATE POLICY "Salarizare can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (can_manage_salarizare(auth.uid()));

-- Update handle_new_user to include salarizare label
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pre_role app_role;
  role_label text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email));
  
  SELECT role INTO pre_role
  FROM public.pre_assigned_roles
  WHERE LOWER(email) = LOWER(new.email)
  LIMIT 1;
  
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
      WHEN 'admin' THEN 'Administrator'
      WHEN 'secretariat' THEN 'Secretariat'
      WHEN 'achizitii_contabilitate' THEN 'Achiziții & Contabilitate'
      WHEN 'salarizare' THEN 'Salarizare'
      WHEN 'bibliotecar' THEN 'Bibliotecar'
      ELSE 'Angajat'
    END;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      new.id,
      'Rol pre-atribuit aplicat',
      'Bine ai venit! Ți-a fost atribuit rolul de ' || role_label || '. Acest rol a fost configurat de administratorul sistemului.',
      'success'
    );

    DELETE FROM public.pre_assigned_roles WHERE LOWER(email) = LOWER(new.email);
  END IF;
  
  RETURN new;
END;
$function$;
