-- Create function to check if user can manage procurement
CREATE OR REPLACE FUNCTION public.can_manage_procurement(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin', 'director', 'achizitii_contabilitate')
  )
$$;

-- Update notifications INSERT policy to include procurement role
DROP POLICY IF EXISTS "Users can only create notifications for themselves or system ca" ON public.notifications;

CREATE POLICY "Users can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) OR 
  can_manage_content(auth.uid()) OR 
  can_manage_hr(auth.uid()) OR
  can_manage_procurement(auth.uid())
);