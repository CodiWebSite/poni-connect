
-- Enums for medical module
CREATE TYPE public.medical_fitness_status AS ENUM ('apt', 'apt_conditionat', 'inapt', 'pending');
CREATE TYPE public.consultation_type AS ENUM ('angajare', 'periodic', 'reluare', 'urgenta', 'altele');
CREATE TYPE public.exam_status AS ENUM ('scheduled', 'completed', 'missed', 'cancelled');

-- Security definer functions
CREATE OR REPLACE FUNCTION public.can_manage_medical(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'medic_medicina_muncii'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_medical_status(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('medic_medicina_muncii', 'hr', 'sef_srus', 'super_admin')
  )
$$;

-- medical_records
CREATE TABLE public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epd_id uuid NOT NULL REFERENCES public.employee_personal_data(id) ON DELETE CASCADE,
  medical_fitness medical_fitness_status NOT NULL DEFAULT 'pending',
  fitness_valid_until date,
  risk_category text,
  chronic_conditions text,
  restrictions text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(epd_id)
);
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Doctor full access medical_records" ON public.medical_records
  FOR ALL TO authenticated
  USING (can_manage_medical(auth.uid()))
  WITH CHECK (can_manage_medical(auth.uid()));

CREATE POLICY "HR can view medical status" ON public.medical_records
  FOR SELECT TO authenticated
  USING (can_view_medical_status(auth.uid()));

-- medical_consultations
CREATE TABLE public.medical_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_record_id uuid NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  consultation_type consultation_type NOT NULL DEFAULT 'periodic',
  consultation_date date NOT NULL DEFAULT CURRENT_DATE,
  diagnosis text,
  recommendations text,
  next_consultation_date date,
  doctor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor full access medical_consultations" ON public.medical_consultations
  FOR ALL TO authenticated
  USING (can_manage_medical(auth.uid()))
  WITH CHECK (can_manage_medical(auth.uid()));

-- medical_scheduled_exams
CREATE TABLE public.medical_scheduled_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epd_id uuid NOT NULL REFERENCES public.employee_personal_data(id) ON DELETE CASCADE,
  exam_type text NOT NULL DEFAULT 'periodic',
  scheduled_date date NOT NULL,
  status exam_status NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_scheduled_exams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_medical_scheduled_exams_updated_at
  BEFORE UPDATE ON public.medical_scheduled_exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Doctor full access medical_scheduled_exams" ON public.medical_scheduled_exams
  FOR ALL TO authenticated
  USING (can_manage_medical(auth.uid()))
  WITH CHECK (can_manage_medical(auth.uid()));

CREATE POLICY "HR can view scheduled exams" ON public.medical_scheduled_exams
  FOR SELECT TO authenticated
  USING (can_view_medical_status(auth.uid()));

-- medical_documents
CREATE TABLE public.medical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_record_id uuid NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'aviz',
  file_url text NOT NULL,
  file_name text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor full access medical_documents" ON public.medical_documents
  FOR ALL TO authenticated
  USING (can_manage_medical(auth.uid()))
  WITH CHECK (can_manage_medical(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-documents', 'medical-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Doctor can upload medical docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'medical-documents' AND can_manage_medical(auth.uid()));

CREATE POLICY "Doctor can view medical docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'medical-documents' AND can_manage_medical(auth.uid()));

CREATE POLICY "Doctor can delete medical docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'medical-documents' AND can_manage_medical(auth.uid()));
