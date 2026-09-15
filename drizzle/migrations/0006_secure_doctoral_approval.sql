CREATE TRIGGER update_doctoral_profiles_updated_at BEFORE UPDATE ON public.doctoral_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctoral_milestones_updated_at BEFORE UPDATE ON public.doctoral_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctoral_documents_updated_at BEFORE UPDATE ON public.doctoral_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.review_doctoral_application(_profile_id uuid, _decision text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid; v_email text; v_confirmed_at timestamptz;
BEGIN
  IF NOT public.can_manage_doctoral(auth.uid()) THEN RAISE EXCEPTION 'Acces interzis'; END IF;
  IF _decision NOT IN ('active','changes_requested','rejected','suspended','completed','withdrawn') THEN RAISE EXCEPTION 'Decizie invalidă'; END IF;
  SELECT p.user_id, u.email, u.email_confirmed_at INTO v_user_id, v_email, v_confirmed_at FROM public.doctoral_profiles p JOIN auth.users u ON u.id=p.user_id WHERE p.id=_profile_id FOR UPDATE OF p;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Cererea nu există'; END IF;
  IF _decision='active' AND (v_confirmed_at IS NULL OR lower(split_part(v_email,'@',2)) <> 'icmpp.ro') THEN RAISE EXCEPTION 'Adresa instituțională trebuie confirmată înainte de aprobare'; END IF;
  UPDATE public.doctoral_profiles SET status=_decision,admin_notes=_notes,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=_profile_id;
  IF _decision='active' THEN
    DELETE FROM public.user_roles WHERE user_id=v_user_id AND role IN ('user','doctorand_pending');
    INSERT INTO public.user_roles(user_id,role) VALUES(v_user_id,'doctorand') ON CONFLICT(user_id,role) DO NOTHING;
    INSERT INTO public.notifications(user_id,title,message,type,related_type,related_id) VALUES(v_user_id,'Cererea a fost aprobată','Contul tău de doctorand este activ. Bun venit în Spațiul Doctoral!','success','doctoral_profile',_profile_id);
  ELSIF _decision IN ('rejected','suspended','withdrawn') THEN
    DELETE FROM public.user_roles WHERE user_id=v_user_id AND role='doctorand';
    INSERT INTO public.user_roles(user_id,role) VALUES(v_user_id,'doctorand_pending') ON CONFLICT(user_id,role) DO NOTHING;
    INSERT INTO public.notifications(user_id,title,message,type,related_type,related_id) VALUES(v_user_id,'Actualizare cerere doctorand',COALESCE(_notes,'Cererea ta a fost actualizată.'),'warning','doctoral_profile',_profile_id);
  ELSIF _decision='changes_requested' THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_type,related_id) VALUES(v_user_id,'Sunt necesare completări',COALESCE(_notes,'Completează informațiile cerute pentru contul de doctorand.'),'warning','doctoral_profile',_profile_id);
  END IF;
  PERFORM public.log_audit_event(auth.uid(),'review_doctoral_application','doctoral_profile',_profile_id::text,jsonb_build_object('decision',_decision));
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_doctoral_application(uuid,text,text) TO authenticated;