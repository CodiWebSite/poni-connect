
-- Enum status
DO $$ BEGIN
  CREATE TYPE public.meeting_status AS ENUM ('scheduled','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: who can manage meetings
CREATE OR REPLACE FUNCTION public.can_manage_meetings(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin'::app_role,'director_institut'::app_role,'director_adjunct'::app_role,'secretariat'::app_role)
  )
$$;

-- Default recipients (director + secretariat) — restricted to authorized callers
CREATE OR REPLACE FUNCTION public.get_meeting_default_recipients()
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emails text[];
BEGIN
  IF NOT public.can_manage_meetings(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT lower(u.email)) FILTER (WHERE u.email IS NOT NULL), '{}')
  INTO v_emails
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role IN ('director_institut'::app_role,'director_adjunct'::app_role,'secretariat'::app_role);
  RETURN v_emails;
END;
$$;

-- Table
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  location text,
  participants text,
  notes text,
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_emails text[] NOT NULL DEFAULT '{}',
  reminder_offset_minutes integer NOT NULL DEFAULT 30,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meetings_end_after_start CHECK (end_at > start_at),
  CONSTRAINT meetings_offset_valid CHECK (reminder_offset_minutes IN (10,30,60,1440))
);

CREATE INDEX IF NOT EXISTS idx_meetings_start_at ON public.meetings(start_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

-- RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_select_authorized" ON public.meetings
  FOR SELECT TO authenticated
  USING (public.can_manage_meetings(auth.uid()));

CREATE POLICY "meetings_insert_authorized" ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_meetings(auth.uid()));

CREATE POLICY "meetings_update_authorized" ON public.meetings
  FOR UPDATE TO authenticated
  USING (public.can_manage_meetings(auth.uid()))
  WITH CHECK (public.can_manage_meetings(auth.uid()));

CREATE POLICY "meetings_delete_authorized" ON public.meetings
  FOR DELETE TO authenticated
  USING (public.can_manage_meetings(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_meetings_updated_at ON public.meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
