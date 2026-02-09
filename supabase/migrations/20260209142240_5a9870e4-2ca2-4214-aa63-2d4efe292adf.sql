
-- Drop and recreate the delete policy to include hr and super_admin roles
DROP POLICY IF EXISTS "Admins can delete HR requests" ON public.hr_requests;
CREATE POLICY "Admins and HR can delete HR requests"
  ON public.hr_requests
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role)
  );

-- Also update the UPDATE policy to include HR
DROP POLICY IF EXISTS "Admins can update HR requests" ON public.hr_requests;
CREATE POLICY "Admins and HR can update HR requests"
  ON public.hr_requests
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role)
  );

-- Also update the SELECT policy so HR can view all requests
DROP POLICY IF EXISTS "Admins can view all HR requests" ON public.hr_requests;
CREATE POLICY "Admins and HR can view all HR requests"
  ON public.hr_requests
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role)
  );
