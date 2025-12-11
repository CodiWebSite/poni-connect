-- Update delete policy to allow deleting pending requests too
DROP POLICY IF EXISTS "Users can delete own draft requests" ON public.procurement_requests;

CREATE POLICY "Users can delete own pending requests"
ON public.procurement_requests
FOR DELETE
USING (
  auth.uid() = user_id AND 
  status IN ('draft', 'pending_department_head', 'pending_procurement', 'pending_director', 'pending_cfp')
);