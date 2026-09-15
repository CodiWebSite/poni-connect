CREATE OR REPLACE FUNCTION public.notify_doctoral_student(_profile_id uuid, _title text, _message text, _type text DEFAULT 'info')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE target_user uuid;
BEGIN
  SELECT user_id INTO target_user FROM public.doctoral_profiles
  WHERE id = _profile_id AND (coordinator_user_id = auth.uid() OR public.can_manage_doctoral(auth.uid()));
  IF target_user IS NULL THEN
    RAISE EXCEPTION 'Nu ai dreptul să notifici acest doctorand';
  END IF;
  INSERT INTO public.notifications(user_id, title, message, type, related_type)
  VALUES (target_user, _title, _message, _type, 'doctoral');
END;
$$;

REVOKE ALL ON FUNCTION public.notify_doctoral_student(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_doctoral_student(uuid, text, text, text) TO authenticated;