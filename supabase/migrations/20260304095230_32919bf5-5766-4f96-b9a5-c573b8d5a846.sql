
CREATE OR REPLACE FUNCTION public.notify_admin_helpdesk_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role IN ('super_admin', 'admin')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      admin_record.user_id,
      'Tichet HelpDesk nou',
      NEW.name || ' (' || NEW.email || ') — ' || COALESCE(NEW.subject, 'General'),
      'warning',
      'helpdesk_ticket',
      NEW.id::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_helpdesk_ticket_insert
  AFTER INSERT ON public.helpdesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_helpdesk_ticket();
