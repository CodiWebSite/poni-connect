
CREATE TABLE public.meeting_reminder_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  recipients_total int NOT NULL DEFAULT 0,
  recipients_sent int NOT NULL DEFAULT 0,
  status_code int,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mrl_meeting_id ON public.meeting_reminder_logs(meeting_id);
CREATE INDEX idx_mrl_attempted_at ON public.meeting_reminder_logs(attempted_at DESC);
CREATE INDEX idx_mrl_success ON public.meeting_reminder_logs(success) WHERE success = false;

GRANT SELECT ON public.meeting_reminder_logs TO authenticated;
GRANT ALL ON public.meeting_reminder_logs TO service_role;

ALTER TABLE public.meeting_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meeting managers can view reminder logs"
ON public.meeting_reminder_logs
FOR SELECT
TO authenticated
USING (public.can_manage_meetings(auth.uid()));
