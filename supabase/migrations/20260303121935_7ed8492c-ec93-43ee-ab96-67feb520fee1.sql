
-- =============================================
-- System Incidents (status page)
-- =============================================
CREATE TABLE public.system_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  status TEXT NOT NULL DEFAULT 'investigating',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access system_incidents"
ON public.system_incidents FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_system_incidents_updated_at
BEFORE UPDATE ON public.system_incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Backup / Restore Test Logs
-- =============================================
CREATE TABLE public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'backup',
  status TEXT NOT NULL DEFAULT 'success',
  size_info TEXT,
  notes TEXT,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access backup_logs"
ON public.backup_logs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
