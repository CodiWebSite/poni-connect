
-- Add attachments and links columns to announcements
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]'::jsonb;

-- Allow authors to update their own announcements
CREATE POLICY "Authors can update own announcements"
ON public.announcements FOR UPDATE
USING (auth.uid() = author_id);

-- Allow authors to delete their own announcements
CREATE POLICY "Authors can delete own announcements"
ON public.announcements FOR DELETE
USING (auth.uid() = author_id);

-- Allow admins/super_admins to delete any announcement
CREATE POLICY "Admins can delete any announcement"
ON public.announcements FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow admins/super_admins to update any announcement
CREATE POLICY "Admins can update any announcement"
ON public.announcements FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
