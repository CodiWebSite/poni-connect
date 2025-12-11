-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  related_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Authenticated users can create notifications (for HR workflow)
CREATE POLICY "Authenticated users can create notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to check if user has elevated role (can manage content)
CREATE OR REPLACE FUNCTION public.can_manage_content(_user_id uuid)
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
      AND role IN ('admin', 'super_admin', 'department_head', 'director', 'secretariat')
  )
$$;

-- Update RLS policies for announcements
DROP POLICY IF EXISTS "Authenticated users can create announcements" ON public.announcements;
CREATE POLICY "Elevated users can create announcements" 
ON public.announcements FOR INSERT 
WITH CHECK (can_manage_content(auth.uid()));

DROP POLICY IF EXISTS "Only admins can update announcements" ON public.announcements;
CREATE POLICY "Elevated users can update announcements" 
ON public.announcements FOR UPDATE 
USING (can_manage_content(auth.uid()));

DROP POLICY IF EXISTS "Only admins can delete announcements" ON public.announcements;
CREATE POLICY "Elevated users can delete announcements" 
ON public.announcements FOR DELETE 
USING (can_manage_content(auth.uid()));

-- Update RLS policies for documents
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.documents;
CREATE POLICY "Elevated users can upload documents" 
ON public.documents FOR INSERT 
WITH CHECK (can_manage_content(auth.uid()));

DROP POLICY IF EXISTS "Only admins can update documents" ON public.documents;
CREATE POLICY "Elevated users can update documents" 
ON public.documents FOR UPDATE 
USING (can_manage_content(auth.uid()));

DROP POLICY IF EXISTS "Only admins can delete documents" ON public.documents;
CREATE POLICY "Elevated users can delete documents" 
ON public.documents FOR DELETE 
USING (can_manage_content(auth.uid()));

-- Update RLS policies for events
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
CREATE POLICY "Elevated users can create events" 
ON public.events FOR INSERT 
WITH CHECK (can_manage_content(auth.uid()));

DROP POLICY IF EXISTS "Only admins can update events" ON public.events;
CREATE POLICY "Elevated users can update events" 
ON public.events FOR UPDATE 
USING (can_manage_content(auth.uid()));

DROP POLICY IF EXISTS "Only admins can delete events" ON public.events;
CREATE POLICY "Elevated users can delete events" 
ON public.events FOR DELETE 
USING (can_manage_content(auth.uid()));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;