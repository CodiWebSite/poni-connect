-- Fix PUBLIC_DATA_EXPOSURE: Restrict audience records access to need-based

-- Drop existing broad access policy
DROP POLICY IF EXISTS "Secretariat can view all audiences" ON public.audiences;

-- Create more restrictive policy: secretariat can only view active audiences or ones they created
-- Completed/cancelled audiences older than 90 days are restricted unless they created them
CREATE POLICY "Secretariat can view relevant audiences"
ON public.audiences
FOR SELECT
TO authenticated
USING (
  can_manage_secretariat(auth.uid()) AND (
    created_by = auth.uid() OR  -- Creator always has access
    status IN ('pending', 'confirmed') OR  -- Active audiences visible to all secretariat
    (scheduled_date > NOW() - INTERVAL '90 days')  -- Recent audiences (within 90 days)
  )
);