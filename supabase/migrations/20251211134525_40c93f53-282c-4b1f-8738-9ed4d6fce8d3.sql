-- Create function to check if user can manage HR records
CREATE OR REPLACE FUNCTION public.can_manage_hr(_user_id uuid)
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
      AND role IN ('admin', 'super_admin', 'hr', 'director')
  )
$$;

-- Update RLS policies for employee_records to include HR role
DROP POLICY IF EXISTS "Admins can view all records" ON public.employee_records;
DROP POLICY IF EXISTS "Admins can insert records" ON public.employee_records;
DROP POLICY IF EXISTS "Admins can update records" ON public.employee_records;
DROP POLICY IF EXISTS "Admins can delete records" ON public.employee_records;

CREATE POLICY "HR can view all records" 
ON public.employee_records 
FOR SELECT 
USING (can_manage_hr(auth.uid()));

CREATE POLICY "HR can insert records" 
ON public.employee_records 
FOR INSERT 
WITH CHECK (can_manage_hr(auth.uid()));

CREATE POLICY "HR can update records" 
ON public.employee_records 
FOR UPDATE 
USING (can_manage_hr(auth.uid()));

CREATE POLICY "HR can delete records" 
ON public.employee_records 
FOR DELETE 
USING (can_manage_hr(auth.uid()));

-- Update RLS policies for employee_documents to include HR role
DROP POLICY IF EXISTS "Admins can view all documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Admins can insert documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.employee_documents;

CREATE POLICY "HR can view all documents" 
ON public.employee_documents 
FOR SELECT 
USING (can_manage_hr(auth.uid()));

CREATE POLICY "HR can insert documents" 
ON public.employee_documents 
FOR INSERT 
WITH CHECK (can_manage_hr(auth.uid()));

CREATE POLICY "HR can update documents" 
ON public.employee_documents 
FOR UPDATE 
USING (can_manage_hr(auth.uid()));

CREATE POLICY "HR can delete documents" 
ON public.employee_documents 
FOR DELETE 
USING (can_manage_hr(auth.uid()));

-- Update storage policies for employee-documents bucket to include HR role
DROP POLICY IF EXISTS "Admins can view all employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee documents" ON storage.objects;

CREATE POLICY "HR can view all employee documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-documents' AND can_manage_hr(auth.uid()));

CREATE POLICY "HR can upload employee documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'employee-documents' AND can_manage_hr(auth.uid()));

CREATE POLICY "HR can update employee documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'employee-documents' AND can_manage_hr(auth.uid()));

CREATE POLICY "HR can delete employee documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'employee-documents' AND can_manage_hr(auth.uid()));