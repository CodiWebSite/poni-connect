
-- =========================================================================
-- BATCH 1 — Secretariat Digital / Registratură Digitală
-- Migrația 001 + 002 + 003 (aditive, fără DROP, fără atingerea altor tabele)
-- =========================================================================

-- -------------------------------------------------------------------------
-- 001_registry_enums.sql
-- -------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.registry_entry_type AS ENUM ('intrare','iesire','intern');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.registry_confidentiality AS ENUM (
    'internal_normal',
    'department_only',
    'secretariat_only',
    'hr_sensitive',
    'legal_sensitive',
    'financial_sensitive',
    'restricted_management'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.registry_request_status AS ENUM (
    'draft',
    'submitted_to_secretariat',
    'needs_correction',
    'approved_registered',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.registry_entry_status AS ENUM (
    'active',
    'resolved',
    'dispatched',
    'cancelled',
    'archived_ready'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- -------------------------------------------------------------------------
-- 002_registry_department_settings_and_operators.sql
-- -------------------------------------------------------------------------

-- Configurare departamente registratură (sursă canonică)
CREATE TABLE IF NOT EXISTS public.registry_department_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_key text NOT NULL UNIQUE,
  department_label text NOT NULL,
  profile_department_value text NOT NULL,
  draft_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicitate case-insensitive pe mapping-ul către profiles.department
CREATE UNIQUE INDEX IF NOT EXISTS registry_department_settings_profile_dept_lower_idx
  ON public.registry_department_settings (lower(profile_department_value));

-- Unicitate case-insensitive pe prefix-ul draft
CREATE UNIQUE INDEX IF NOT EXISTS registry_department_settings_draft_prefix_lower_idx
  ON public.registry_department_settings (lower(draft_prefix));

ALTER TABLE public.registry_department_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: orice utilizator autentificat
CREATE POLICY "rds_select_auth" ON public.registry_department_settings
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: doar super_admin
CREATE POLICY "rds_insert_super_admin" ON public.registry_department_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "rds_update_super_admin" ON public.registry_department_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "rds_delete_super_admin" ON public.registry_department_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Trigger updated_at
CREATE TRIGGER trg_rds_updated_at
  BEFORE UPDATE ON public.registry_department_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Operatori desemnați pe departament
CREATE TABLE IF NOT EXISTS public.registry_department_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_key text NOT NULL
    REFERENCES public.registry_department_settings(department_key) ON DELETE RESTRICT ON UPDATE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (department_key, user_id)
);

CREATE INDEX IF NOT EXISTS registry_department_operators_user_idx
  ON public.registry_department_operators (user_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS registry_department_operators_dept_idx
  ON public.registry_department_operators (department_key) WHERE is_active;

ALTER TABLE public.registry_department_operators ENABLE ROW LEVEL SECURITY;

-- SELECT: orice utilizator autentificat (transparență „cine este operator”)
CREATE POLICY "rdo_select_auth" ON public.registry_department_operators
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: doar super_admin
CREATE POLICY "rdo_insert_super_admin" ON public.registry_department_operators
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "rdo_update_super_admin" ON public.registry_department_operators
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "rdo_delete_super_admin" ON public.registry_department_operators
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));


-- -------------------------------------------------------------------------
-- 003_registry_counters.sql
-- -------------------------------------------------------------------------

-- Contor tranzacțional pentru alocarea numărului oficial
-- Alocarea + INSERT entry + UPDATE request se execută ATOMIC în aceeași
-- tranzacție într-un RPC SECURITY DEFINER (va fi creat în batch 2/3).
-- Goluri NU apar prin rollback normal de tranzacție; orice gol nejustificat
-- = anomalie de integritate care va fi raportată în panoul de administrare.
CREATE TABLE IF NOT EXISTS public.registry_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_key text NOT NULL,
  year int NOT NULL,
  current_value bigint NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_key, year),
  CHECK (current_value >= 0),
  CHECK (year BETWEEN 2000 AND 2999)
);

ALTER TABLE public.registry_counters ENABLE ROW LEVEL SECURITY;

-- Accesul direct este permis DOAR super_admin (pentru audit/diagnostic).
-- Alocarea se va face exclusiv prin RPC SECURITY DEFINER (batch ulterior).
CREATE POLICY "rc_select_super_admin" ON public.registry_counters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "rc_insert_super_admin" ON public.registry_counters
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "rc_update_super_admin" ON public.registry_counters
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "rc_delete_super_admin" ON public.registry_counters
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Seed inițial: serie oficială + serie demo pentru anul curent
INSERT INTO public.registry_counters (series_key, year, current_value, is_demo)
VALUES
  ('ICMPP-REG', EXTRACT(YEAR FROM now())::int, 0, false),
  ('DEMO-REG',  EXTRACT(YEAR FROM now())::int, 0, true)
ON CONFLICT (series_key, year) DO NOTHING;
