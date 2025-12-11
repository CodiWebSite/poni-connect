-- Create employee_records table for tracking employee data and leave balance
CREATE TABLE public.employee_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  hire_date DATE,
  contract_type TEXT DEFAULT 'nedeterminat',
  total_leave_days INTEGER NOT NULL DEFAULT 21,
  used_leave_days INTEGER NOT NULL DEFAULT 0,
  remaining_leave_days INTEGER GENERATED ALWAYS AS (total_leave_days - used_leave_days) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee_documents table for personal documents (contracts, CV, etc.)
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL, -- 'cv', 'contract', 'anexa', 'certificat', etc.
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for employee_records
CREATE POLICY "Users can view their own record" 
ON public.employee_records 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all records" 
ON public.employee_records 
FOR SELECT 
USING (can_manage_content(auth.uid()));

CREATE POLICY "Admins can insert records" 
ON public.employee_records 
FOR INSERT 
WITH CHECK (can_manage_content(auth.uid()));

CREATE POLICY "Admins can update records" 
ON public.employee_records 
FOR UPDATE 
USING (can_manage_content(auth.uid()));

CREATE POLICY "Admins can delete records" 
ON public.employee_records 
FOR DELETE 
USING (can_manage_content(auth.uid()));

-- RLS policies for employee_documents
CREATE POLICY "Users can view their own documents" 
ON public.employee_documents 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents" 
ON public.employee_documents 
FOR SELECT 
USING (can_manage_content(auth.uid()));

CREATE POLICY "Admins can insert documents" 
ON public.employee_documents 
FOR INSERT 
WITH CHECK (can_manage_content(auth.uid()));

CREATE POLICY "Admins can update documents" 
ON public.employee_documents 
FOR UPDATE 
USING (can_manage_content(auth.uid()));

CREATE POLICY "Admins can delete documents" 
ON public.employee_documents 
FOR DELETE 
USING (can_manage_content(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_employee_records_updated_at
BEFORE UPDATE ON public.employee_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);

-- Storage policies for employee-documents bucket
CREATE POLICY "Users can view their own employee documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all employee documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-documents' AND can_manage_content(auth.uid()));

CREATE POLICY "Admins can upload employee documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'employee-documents' AND can_manage_content(auth.uid()));

CREATE POLICY "Admins can update employee documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'employee-documents' AND can_manage_content(auth.uid()));

CREATE POLICY "Admins can delete employee documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'employee-documents' AND can_manage_content(auth.uid()));