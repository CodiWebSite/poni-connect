-- Allow HR personnel to update any profile
CREATE POLICY "HR can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (can_manage_hr(auth.uid()));