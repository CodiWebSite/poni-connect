CREATE TABLE public.decision_registry_access (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.decision_registry_access TO authenticated;
GRANT ALL ON public.decision_registry_access TO service_role;
ALTER TABLE public.decision_registry_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_decision_registry(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin') OR EXISTS (SELECT 1 FROM public.decision_registry_access WHERE user_id = _user_id)
$$;

CREATE POLICY "Registry members view access" ON public.decision_registry_access FOR SELECT TO authenticated USING (public.can_access_decision_registry(auth.uid()));
CREATE POLICY "Super admins manage access ins" ON public.decision_registry_access FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage access del" ON public.decision_registry_access FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.decision_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  number int NOT NULL,
  month int NOT NULL,
  title text NOT NULL,
  decision_date date,
  funding_source text,
  author_initials text,
  status text NOT NULL DEFAULT 'active',
  cancel_reason text,
  edit_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, number)
);
GRANT SELECT, INSERT, UPDATE ON public.decision_registry TO authenticated;
GRANT ALL ON public.decision_registry TO service_role;
ALTER TABLE public.decision_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Registry view" ON public.decision_registry FOR SELECT TO authenticated USING (public.can_access_decision_registry(auth.uid()));
CREATE POLICY "Registry insert" ON public.decision_registry FOR INSERT TO authenticated WITH CHECK (public.can_access_decision_registry(auth.uid()));
CREATE POLICY "Registry update" ON public.decision_registry FOR UPDATE TO authenticated USING (public.can_access_decision_registry(auth.uid())) WITH CHECK (public.can_access_decision_registry(auth.uid()));

CREATE OR REPLACE FUNCTION public.decision_registry_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.year IS NULL THEN NEW.year := EXTRACT(YEAR FROM COALESCE(NEW.decision_date, current_date)); END IF;
    IF NEW.number IS NULL OR NEW.number = 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext('decision_registry_' || NEW.year));
      SELECT COALESCE(MAX(number),0)+1 INTO NEW.number FROM public.decision_registry WHERE year = NEW.year;
    END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  END IF;
  IF NEW.month IS NULL OR NEW.month = 0 THEN NEW.month := EXTRACT(MONTH FROM COALESCE(NEW.decision_date, current_date)); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER decision_registry_before BEFORE INSERT OR UPDATE ON public.decision_registry FOR EACH ROW EXECUTE FUNCTION public.decision_registry_before();
CREATE INDEX decision_registry_year_month_idx ON public.decision_registry (year, month, number);