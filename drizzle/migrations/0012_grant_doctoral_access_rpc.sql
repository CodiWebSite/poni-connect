CREATE OR REPLACE FUNCTION public.grant_doctoral_access(_user_id uuid, _thesis_title text DEFAULT NULL, _coordinator_user_id uuid DEFAULT NULL, _study_year integer DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _name text;
  _coord_name text;
  _profile_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.can_manage_doctoral(auth.uid())) THEN
    RAISE EXCEPTION 'Nu ai permisiunea de a acorda acces doctoral';
  END IF;

  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _user_id;
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Contul nu are e-mail înregistrat';
  END IF;

  SELECT p.full_name INTO _name FROM public.profiles p WHERE p.user_id = _user_id;
  _name := COALESCE(NULLIF(trim(_name), ''), _email);

  IF _coordinator_user_id IS NOT NULL THEN
    SELECT c.full_name INTO _coord_name FROM public.doctoral_coordinators c WHERE c.user_id = _coordinator_user_id LIMIT 1;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'doctorand')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'doctorand_pending';

  SELECT dp.id INTO _profile_id FROM public.doctoral_profiles dp WHERE dp.user_id = _user_id LIMIT 1;

  IF _profile_id IS NULL THEN
    INSERT INTO public.doctoral_profiles (user_id, email, full_name, thesis_title, coordinator_user_id, coordinator_name, study_year, status, reviewed_by, reviewed_at)
    VALUES (_user_id, _email, _name, NULLIF(trim(COALESCE(_thesis_title, '')), ''), _coordinator_user_id, _coord_name, _study_year, 'active', auth.uid(), now())
    RETURNING id INTO _profile_id;
  ELSE
    UPDATE public.doctoral_profiles
       SET status = 'active',
           thesis_title = COALESCE(NULLIF(trim(COALESCE(_thesis_title, '')), ''), thesis_title),
           coordinator_user_id = COALESCE(_coordinator_user_id, coordinator_user_id),
           coordinator_name = COALESCE(_coord_name, coordinator_name),
           study_year = COALESCE(_study_year, study_year),
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = _profile_id;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (_user_id, 'Acces la Spațiul Doctoral', 'Ai primit acces la Spațiul Doctoral ICMPP. Îl găsești în meniul din stânga.', 'info', '/doctoral');

  RETURN _profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_doctoral_access(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.can_manage_doctoral(auth.uid())) THEN
    RAISE EXCEPTION 'Nu ai permisiunea de a retrage accesul doctoral';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role IN ('doctorand', 'doctorand_pending');
  UPDATE public.doctoral_profiles SET status = 'suspended', updated_at = now() WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_doctoral_access(uuid, text, uuid, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.revoke_doctoral_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.grant_doctoral_access(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_doctoral_access(uuid) TO authenticated;