
-- Table to store health check history for latency chart
CREATE TABLE public.health_check_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  overall text NOT NULL DEFAULT 'healthy',
  checks jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.health_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view health logs"
  ON public.health_check_logs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can insert health logs"
  ON public.health_check_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Auto-cleanup: keep only last 7 days
CREATE POLICY "Super admin can delete health logs"
  ON public.health_check_logs FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Index for time-based queries
CREATE INDEX idx_health_check_logs_checked_at ON public.health_check_logs (checked_at DESC);
