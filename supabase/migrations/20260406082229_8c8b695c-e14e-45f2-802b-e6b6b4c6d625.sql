
-- Trigger function for security events → Telegram
CREATE OR REPLACE FUNCTION public.notify_telegram_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  severity_label text;
BEGIN
  -- Only notify for warning and critical events
  IF NEW.severity NOT IN ('warning', 'critical') THEN
    RETURN NEW;
  END IF;

  severity_label := CASE NEW.severity
    WHEN 'critical' THEN '🔴 CRITIC'
    WHEN 'warning' THEN '⚠️ ATENȚIE'
    ELSE 'ℹ️ Info'
  END;

  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'security_alert',
      'title', 'Alertă de Securitate — ' || severity_label,
      'message', COALESCE(NEW.details->>'message', NEW.event_type),
      'severity', NEW.severity,
      'details', jsonb_build_object(
        'Tip eveniment', NEW.event_type,
        'IP', COALESCE(NEW.ip_address, 'N/A'),
        'User Agent', LEFT(COALESCE(NEW.user_agent, 'N/A'), 80)
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block inserts if Telegram fails
  RAISE WARNING 'Telegram notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_telegram_security_alert
AFTER INSERT ON public.security_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram_security_event();

-- Trigger function for account requests → Telegram
CREATE OR REPLACE FUNCTION public.notify_telegram_account_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'account_request',
      'title', 'Cerere nouă de cont',
      'message', NEW.full_name || ' (' || NEW.email || ') solicită crearea unui cont.',
      'severity', 'info',
      'details', jsonb_build_object(
        'Nume', NEW.full_name,
        'Email', NEW.email,
        'Mesaj', COALESCE(LEFT(NEW.message, 200), 'Fără mesaj')
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Telegram notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_telegram_account_request
AFTER INSERT ON public.account_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram_account_request();
