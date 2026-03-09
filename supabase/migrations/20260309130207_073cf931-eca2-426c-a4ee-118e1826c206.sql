
-- Table for users allowed to manage events
CREATE TABLE public.event_publishers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.event_publishers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage event_publishers"
  ON public.event_publishers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated can view event_publishers"
  ON public.event_publishers FOR SELECT TO authenticated
  USING (true);

-- Function to check event management rights
CREATE OR REPLACE FUNCTION public.can_publish_events(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT can_manage_content(_user_id)
    OR EXISTS (SELECT 1 FROM public.event_publishers WHERE user_id = _user_id)
$$;

-- Update events RLS policies
DROP POLICY IF EXISTS "Elevated users can create events" ON public.events;
CREATE POLICY "Users with publish rights can create events"
  ON public.events FOR INSERT TO public
  WITH CHECK (can_publish_events(auth.uid()));

DROP POLICY IF EXISTS "Elevated users can update events" ON public.events;
CREATE POLICY "Publishers can update events"
  ON public.events FOR UPDATE TO public
  USING (can_publish_events(auth.uid()));

DROP POLICY IF EXISTS "Elevated users can delete events" ON public.events;
CREATE POLICY "Publishers can delete events"
  ON public.events FOR DELETE TO public
  USING (can_publish_events(auth.uid()));
