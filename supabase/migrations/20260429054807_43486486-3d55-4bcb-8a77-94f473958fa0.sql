
-- Ensure RLS enabled
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins view all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Super admins view all push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger function
CREATE OR REPLACE FUNCTION public.notify_push_on_new_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://erghywhqrxmwqptusbxd.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZ2h5d2hxcnhtd3FwdHVzYnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MzkwMzMsImV4cCI6MjA4MDUxNTAzM30.K3sZj4KFFgfD0mGFJLKd3cSZFuQtAgVCiOkBeuP1u7Y'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'related_id', NEW.related_id,
      'related_type', NEW.related_type,
      'notification_id', NEW.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_on_new_notification ON public.notifications;
CREATE TRIGGER trg_notify_push_on_new_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_new_notification();
