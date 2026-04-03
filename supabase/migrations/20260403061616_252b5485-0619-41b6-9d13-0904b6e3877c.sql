
-- Security events table for comprehensive audit
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_created ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_severity ON public.security_events(severity) WHERE severity IN ('warning', 'critical');

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Users can see their own security events
CREATE POLICY "Users can view own security events"
ON public.security_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Super admins can view all security events  
CREATE POLICY "Super admins view all security events"
ON public.security_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Only service role can insert (edge functions)
-- No INSERT policy for authenticated = only service role can insert

-- Users can acknowledge their own events
CREATE POLICY "Users can acknowledge own events"
ON public.security_events FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
