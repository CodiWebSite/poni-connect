CREATE TABLE public.ops_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  target TEXT,
  error TEXT,
  retry_function TEXT,
  retry_body JSONB,
  status TEXT NOT NULL DEFAULT 'failed',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ops_failures TO authenticated;
GRANT ALL ON public.ops_failures TO service_role;

ALTER TABLE public.ops_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ops failures"
ON public.ops_failures FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ops failures"
ON public.ops_failures FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (true);

CREATE INDEX idx_ops_failures_created_at ON public.ops_failures (created_at DESC);
CREATE INDEX idx_ops_failures_status ON public.ops_failures (status);