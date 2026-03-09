
-- Table to store users who are allowed to publish announcements
CREATE TABLE public.announcement_publishers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.announcement_publishers ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage publishers
CREATE POLICY "Super admins can manage announcement_publishers"
  ON public.announcement_publishers
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- All authenticated can read (needed to check own permissions)
CREATE POLICY "Authenticated can view announcement_publishers"
  ON public.announcement_publishers
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to check if user can publish announcements
CREATE OR REPLACE FUNCTION public.can_publish_announcements(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    can_manage_content(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.announcement_publishers WHERE user_id = _user_id
    )
$$;

-- Update RLS on announcements to use the new function for INSERT
DROP POLICY IF EXISTS "Elevated users can create announcements" ON public.announcements;
CREATE POLICY "Users with publish rights can create announcements"
  ON public.announcements
  FOR INSERT
  TO public
  WITH CHECK (can_publish_announcements(auth.uid()));

-- Update RLS for UPDATE - authors can update own, admins can update any, publishers can update own
DROP POLICY IF EXISTS "Elevated users can update announcements" ON public.announcements;
CREATE POLICY "Publishers can update own announcements"
  ON public.announcements
  FOR UPDATE
  TO public
  USING (
    (auth.uid() = author_id AND can_publish_announcements(auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Update RLS for DELETE
DROP POLICY IF EXISTS "Elevated users can delete announcements" ON public.announcements;
CREATE POLICY "Publishers can delete own announcements"
  ON public.announcements
  FOR DELETE
  TO public
  USING (
    (auth.uid() = author_id AND can_publish_announcements(auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
