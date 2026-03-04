CREATE OR REPLACE FUNCTION public.notify_admin_helpdesk_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      NEW.id::text::uuid
    );
  END LOOP;
  RETURN NEW;
END;
$function$;