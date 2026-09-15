CREATE TABLE public.approval_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL DEFAULT 'leave',
  request_id UUID NOT NULL,
  approver_user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_action TEXT,
  used_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.approval_links TO service_role;

ALTER TABLE public.approval_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approvers can view own approval links"
ON public.approval_links FOR SELECT TO authenticated
USING (approver_user_id = auth.uid());

CREATE INDEX idx_approval_links_request ON public.approval_links (request_id);