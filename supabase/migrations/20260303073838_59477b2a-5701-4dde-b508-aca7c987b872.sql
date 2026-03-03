
-- Update can_manage_content to allow all roles except 'user' to post announcements
CREATE OR REPLACE FUNCTION public.can_manage_content(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role != 'user'
  )
$function$;
