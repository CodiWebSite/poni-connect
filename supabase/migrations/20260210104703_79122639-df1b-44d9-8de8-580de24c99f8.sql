
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pre_role app_role;
  role_label text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email));
  
  -- Check for pre-assigned role
  SELECT role INTO pre_role
  FROM public.pre_assigned_roles
  WHERE LOWER(email) = LOWER(new.email)
  LIMIT 1;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, COALESCE(pre_role, 'user'));
  
  -- If a pre-assigned role was found, notify the user and clean up
  IF pre_role IS NOT NULL THEN
    -- Map role to human-readable label
    role_label := CASE pre_role
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
$$;
