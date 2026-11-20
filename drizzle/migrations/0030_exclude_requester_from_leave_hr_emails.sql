CREATE OR REPLACE FUNCTION public.enqueue_leave_hr_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'pending_department_head' AND NEW.status = 'pending_srus' THEN
    INSERT INTO public.email_outbox (kind, payload, to_email, dedupe_key)
    SELECT DISTINCT 'leave_hr_notice', jsonb_build_object('request_id', NEW.id), lower(u.email),
           'leave_hr:' || NEW.id || ':' || lower(u.email)
    FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
    WHERE r.role = 'hr'
      AND r.user_id <> NEW.user_id
      AND u.email IS NOT NULL
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