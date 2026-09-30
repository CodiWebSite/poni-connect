CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  to_email text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins view outbox" ON public.email_outbox FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX email_outbox_pending_idx ON public.email_outbox (next_attempt_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.enqueue_leave_hr_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'pending_department_head' AND NEW.status = 'pending_srus' THEN
    INSERT INTO public.email_outbox (kind, payload, to_email, dedupe_key)
    SELECT DISTINCT 'leave_hr_notice', jsonb_build_object('request_id', NEW.id), lower(u.email),
           'leave_hr:' || NEW.id || ':' || lower(u.email)
    FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
    WHERE r.role = 'hr' AND u.email IS NOT NULL
    ON CONFLICT (dedupe_key) DO NOTHING;

    BEGIN
      PERFORM net.http_post(
        url := 'https://erghywhqrxmwqptusbxd.supabase.co/functions/v1/process-email-outbox',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enqueue_leave_hr_notice() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER leave_hr_notice_outbox AFTER UPDATE OF status ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.enqueue_leave_hr_notice();