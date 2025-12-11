-- Update RLS policies for procurement_requests to include the new role
DROP POLICY IF EXISTS "Approvers can update requests" ON public.procurement_requests;
DROP POLICY IF EXISTS "Department heads can view department requests" ON public.procurement_requests;

CREATE POLICY "Approvers can update requests" 
ON public.procurement_requests 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'department_head') OR 
  has_role(auth.uid(), 'director') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'achizitii_contabilitate')
);

CREATE POLICY "Elevated roles can view all requests" 
ON public.procurement_requests 
FOR SELECT 
USING (
  has_role(auth.uid(), 'department_head') OR 
  has_role(auth.uid(), 'director') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'achizitii_contabilitate')
);