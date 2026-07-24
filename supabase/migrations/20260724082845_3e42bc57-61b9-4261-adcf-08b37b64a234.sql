
-- ============================================================
-- ENUM: status fluturaș individual
-- ============================================================
CREATE TYPE public.payslip_match_status AS ENUM (
  'matched',       -- asociere directă după nume
  'needs_confirm', -- fuzzy match, admin trebuie să confirme
  'unmatched',     -- nu s-a găsit angajat, asociere manuală
  'duplicate_name',-- omonim, asociere manuală obligatorie
  'distributed'    -- confirmat de admin, vizibil pentru angajat
);

CREATE TYPE public.payslip_batch_status AS ENUM (
  'processing',
  'ready',
  'distributed',
  'failed'
);

-- ============================================================
-- TABELUL: payslip_batches
-- ============================================================
CREATE TABLE public.payslip_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  original_filename TEXT NOT NULL,
  original_file_path TEXT,
  total_slips INT NOT NULL DEFAULT 0,
  matched_count INT NOT NULL DEFAULT 0,
  unmatched_count INT NOT NULL DEFAULT 0,
  status public.payslip_batch_status NOT NULL DEFAULT 'processing',
  notes TEXT,
  distributed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslip_batches TO authenticated;
GRANT ALL ON public.payslip_batches TO service_role;

ALTER TABLE public.payslip_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salarizare and super_admin can view batches"
  ON public.payslip_batches FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

CREATE POLICY "Salarizare and super_admin can insert batches"
  ON public.payslip_batches FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

CREATE POLICY "Salarizare and super_admin can update batches"
  ON public.payslip_batches FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

CREATE POLICY "Salarizare and super_admin can delete batches"
  ON public.payslip_batches FOR DELETE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

-- ============================================================
-- TABELUL: payslip_pilot_users
-- ============================================================
CREATE TABLE public.payslip_pilot_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payslip_pilot_users TO authenticated;
GRANT ALL ON public.payslip_pilot_users TO service_role;

ALTER TABLE public.payslip_pilot_users ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can check IF their OWN email is whitelisted (needed for UI gating).
-- Admin management uses service role via edge function.
CREATE POLICY "Users can see own pilot record"
  ON public.payslip_pilot_users FOR SELECT
  USING (
    LOWER(email) = LOWER(COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

CREATE POLICY "Super admin manages pilot users"
  ON public.payslip_pilot_users FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Seed pilot users
INSERT INTO public.payslip_pilot_users (email, notes) VALUES
  ('condrea.codrin@icmpp.ro', 'Fază pilot – inițiator'),
  ('isache.marius@icmpp.ro', 'Fază pilot'),
  ('hogas.anca@icmpp.ro', 'Fază pilot'),
  ('tofan.dragos@icmpp.ro', 'Fază pilot')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- HELPER: verifică dacă user-ul e în whitelist-ul pilot
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_payslip_pilot_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payslip_pilot_users ppu
    JOIN auth.users u ON LOWER(u.email) = LOWER(ppu.email)
    WHERE u.id = _user_id
  );
$$;

-- ============================================================
-- TABELUL: payslips
-- ============================================================
CREATE TABLE public.payslips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.payslip_batches(id) ON DELETE CASCADE,
  employee_epd_id UUID REFERENCES public.employee_personal_data(id) ON DELETE SET NULL,
  name_detected TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  marca_detected TEXT,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  file_path TEXT,
  net_amount NUMERIC,
  match_status public.payslip_match_status NOT NULL DEFAULT 'unmatched',
  match_notes TEXT,
  distributed_at TIMESTAMPTZ,
  first_downloaded_at TIMESTAMPTZ,
  download_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payslips_batch ON public.payslips(batch_id);
CREATE INDEX idx_payslips_employee ON public.payslips(employee_epd_id);
CREATE INDEX idx_payslips_period ON public.payslips(year, month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Angajatul vede DOAR fluturașii lui, DACĂ e distribuit ȘI e în whitelistul pilot
CREATE POLICY "Employee views own payslips if pilot"
  ON public.payslips FOR SELECT
  USING (
    match_status = 'distributed'
    AND public.is_payslip_pilot_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.employee_personal_data epd
      JOIN public.employee_records er ON er.id = epd.employee_record_id
      WHERE epd.id = payslips.employee_epd_id
        AND er.user_id = auth.uid()
    )
  );

CREATE POLICY "Salarizare and super_admin view all payslips"
  ON public.payslips FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

CREATE POLICY "Salarizare and super_admin manage payslips"
  ON public.payslips FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

-- ============================================================
-- TABELUL: payslip_audit_log
-- ============================================================
CREATE TABLE public.payslip_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.payslip_batches(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- upload, view, download, admin_view, distribute, delete
  ip TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payslip_audit_user ON public.payslip_audit_log(user_id);
CREATE INDEX idx_payslip_audit_payslip ON public.payslip_audit_log(payslip_id);
CREATE INDEX idx_payslip_audit_at ON public.payslip_audit_log(created_at DESC);

GRANT SELECT, INSERT ON public.payslip_audit_log TO authenticated;
GRANT ALL ON public.payslip_audit_log TO service_role;

ALTER TABLE public.payslip_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin views payslip audit"
  ON public.payslip_audit_log FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'salarizare'::app_role)
  );

CREATE POLICY "Users can insert own audit rows"
  ON public.payslip_audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
CREATE TRIGGER trg_payslip_batches_updated_at
  BEFORE UPDATE ON public.payslip_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_payslips_updated_at
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STORAGE POLICIES pentru bucket-ul „payslips" (privat)
-- ============================================================
-- Nu permitem acces direct client. Toate descărcările trec prin edge function
-- cu service role. Doar salarizare/super_admin pot lista/uploada direct.

CREATE POLICY "Salarizare and super_admin manage payslip storage"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'payslips'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'salarizare'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'payslips'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'salarizare'::app_role)
    )
  );
