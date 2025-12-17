-- Create storage bucket for secretariat documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('secretariat-documents', 'secretariat-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for secretariat documents
CREATE POLICY "Secretariat can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'secretariat-documents' 
  AND can_manage_secretariat(auth.uid())
);

CREATE POLICY "Secretariat can view documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'secretariat-documents' 
  AND can_manage_secretariat(auth.uid())
);

CREATE POLICY "Secretariat can update documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'secretariat-documents' 
  AND can_manage_secretariat(auth.uid())
);

CREATE POLICY "Secretariat can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'secretariat-documents' 
  AND can_manage_secretariat(auth.uid())
);