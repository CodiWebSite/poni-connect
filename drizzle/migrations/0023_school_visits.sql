CREATE TABLE public.school_visits_access (user_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.school_visits_access TO authenticated;
GRANT ALL ON public.school_visits_access TO service_role;

CREATE OR REPLACE FUNCTION public.can_access_school_visits(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'super_admin') OR EXISTS (SELECT 1 FROM public.school_visits_access WHERE user_id=_user_id)
$$;

ALTER TABLE public.school_visits_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sva read" ON public.school_visits_access FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "sva insert" ON public.school_visits_access FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "sva delete" ON public.school_visits_access FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.school_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date date NOT NULL,
  visit_time text,
  institution text NOT NULL DEFAULT '',
  request_no text,
  approval_no text,
  participants integer,
  class_level text,
  teachers text,
  status text NOT NULL DEFAULT 'auto',
  notes text,
  cancelled_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.school_visits TO authenticated;
GRANT ALL ON public.school_visits TO service_role;
ALTER TABLE public.school_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv read" ON public.school_visits FOR SELECT TO authenticated USING (public.can_access_school_visits(auth.uid()));
CREATE POLICY "sv insert" ON public.school_visits FOR INSERT TO authenticated WITH CHECK (public.can_access_school_visits(auth.uid()));
CREATE POLICY "sv update" ON public.school_visits FOR UPDATE TO authenticated USING (public.can_access_school_visits(auth.uid())) WITH CHECK (public.can_access_school_visits(auth.uid()));
CREATE TRIGGER sv_touch BEFORE UPDATE ON public.school_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();