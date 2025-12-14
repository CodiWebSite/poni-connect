-- Fix notifications INSERT policy to include procurement officers
DROP POLICY IF EXISTS "Users can only create notifications for themselves or system can create for others" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;

CREATE POLICY "System roles can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  can_manage_content(auth.uid()) OR 
  can_manage_hr(auth.uid()) OR
  can_manage_procurement(auth.uid())
);