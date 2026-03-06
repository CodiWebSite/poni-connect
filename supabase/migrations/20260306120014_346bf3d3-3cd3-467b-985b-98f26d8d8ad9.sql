
-- Add attachment columns to chat_messages
ALTER TABLE public.chat_messages 
  ADD COLUMN attachment_url text,
  ADD COLUMN attachment_type text,
  ADD COLUMN attachment_name text;

-- Make content nullable (for attachment-only messages)
ALTER TABLE public.chat_messages ALTER COLUMN content DROP NOT NULL;

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true);

-- Storage RLS: authenticated users can upload to chat-attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Authenticated users can view chat attachments
CREATE POLICY "Authenticated users can view chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

-- Users can delete their own uploads
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
