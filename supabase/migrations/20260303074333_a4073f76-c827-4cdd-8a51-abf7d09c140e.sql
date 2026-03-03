
-- Create storage bucket for announcement attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('announcement-attachments', 'announcement-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone authenticated can view
CREATE POLICY "Anyone can view announcement attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcement-attachments');

-- Content managers can upload
CREATE POLICY "Content managers can upload announcement attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'announcement-attachments' AND can_manage_content(auth.uid()));

-- Content managers can delete
CREATE POLICY "Content managers can delete announcement attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'announcement-attachments' AND can_manage_content(auth.uid()));
