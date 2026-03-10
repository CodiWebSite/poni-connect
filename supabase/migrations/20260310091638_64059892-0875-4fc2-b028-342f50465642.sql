
-- Function to check same department for archive
CREATE OR REPLACE FUNCTION public.archive_same_department(_doc_department text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _doc_department = get_user_department(auth.uid());
$$;

-- Sequence for registration numbers
CREATE SEQUENCE IF NOT EXISTS archive_reg_seq START 1;

-- Function to generate registration number
CREATE OR REPLACE FUNCTION public.generate_archive_reg_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.registration_number := 'ARH-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('archive_reg_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Table: archive_documents
CREATE TABLE public.archive_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text UNIQUE,
  department text NOT NULL,
  nomenclator_category text NOT NULL,
  retention_years integer NOT NULL DEFAULT 5,
  retention_expires_at date,
  file_url text,
  file_name text,
  file_size bigint,
  description text,
  uploaded_by uuid,
  archived_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-generate registration number
CREATE TRIGGER trg_archive_reg_number
  BEFORE INSERT ON public.archive_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_archive_reg_number();

-- Auto-calculate retention_expires_at
CREATE OR REPLACE FUNCTION public.calc_archive_retention()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.retention_years >= 100 THEN
    NEW.retention_expires_at := '9999-12-31'::date;
  ELSE
    NEW.retention_expires_at := (NEW.archived_at + (NEW.retention_years || ' years')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_archive_retention
  BEFORE INSERT OR UPDATE ON public.archive_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_archive_retention();

-- Table: archive_access_log
CREATE TABLE public.archive_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.archive_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'view',
  accessed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.archive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_access_log ENABLE ROW LEVEL SECURITY;

-- RLS: archive_documents
CREATE POLICY "Same dept or HR can view archive docs"
  ON public.archive_documents FOR SELECT TO authenticated
  USING (archive_same_department(department) OR can_manage_hr(auth.uid()));

CREATE POLICY "Same dept can insert archive docs"
  ON public.archive_documents FOR INSERT TO authenticated
  WITH CHECK (archive_same_department(department) AND auth.uid() = uploaded_by);

CREATE POLICY "HR can update archive docs"
  ON public.archive_documents FOR UPDATE TO authenticated
  USING (can_manage_hr(auth.uid()));

CREATE POLICY "HR can delete expired archive docs"
  ON public.archive_documents FOR DELETE TO authenticated
  USING (can_manage_hr(auth.uid()) AND retention_expires_at <= CURRENT_DATE);

-- RLS: archive_access_log
CREATE POLICY "Users can insert own access log"
  ON public.archive_access_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "HR can view access log"
  ON public.archive_access_log FOR SELECT TO authenticated
  USING (can_manage_hr(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('archive-documents', 'archive-documents', false);

-- Storage policies
CREATE POLICY "Authenticated can upload archive docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archive-documents');

CREATE POLICY "Authenticated can read archive docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'archive-documents');

CREATE POLICY "HR can delete archive storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'archive-documents' AND can_manage_hr(auth.uid()));
