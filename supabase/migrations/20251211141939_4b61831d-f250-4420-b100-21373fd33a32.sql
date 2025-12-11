-- Fix notifications INSERT policy to prevent users from creating notifications for other users
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Users can only create notifications for themselves or system can create for others"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  can_manage_content(auth.uid()) OR 
  can_manage_hr(auth.uid())
);

-- Create a function to check if user can view sensitive profile data
CREATE OR REPLACE FUNCTION public.can_view_sensitive_profile_data(_viewer_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _viewer_id = _profile_user_id OR  -- User can see their own data
    can_manage_hr(_viewer_id)          -- HR can see all data
$$;