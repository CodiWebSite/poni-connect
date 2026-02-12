-- Enable realtime for account_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_requests;

-- Create trigger to notify super_admins when a new account request is submitted
CREATE OR REPLACE FUNCTION public.notify_admin_account_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Notify all super_admins and HR users
  FOR admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role IN ('super_admin', 'hr', 'sef_srus')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      admin_record.user_id,
      'Cerere nouă de creare cont',
      NEW.full_name || ' (' || NEW.email || ') solicită ajutor pentru crearea contului.',
      'warning',
      'account_request',
      NEW.id::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_account_request_insert
  AFTER INSERT ON public.account_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_account_request();
