
-- Categories enum for activities
CREATE TYPE public.activity_category AS ENUM (
  'film', 'muzica', 'jocuri', 'quiz', 'creativ', 'socializare', 'altele'
);

-- Main activities table
CREATE TABLE public.recreational_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category activity_category NOT NULL DEFAULT 'altele',
  location text,
  scheduled_at timestamp with time zone,
  max_participants integer,
  image_url text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'upcoming'
);

-- RSVP responses
CREATE TABLE public.activity_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.recreational_activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  response text NOT NULL DEFAULT 'interested',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

-- Organizers (who can post activities, managed by super-admin)
CREATE TABLE public.activity_organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recreational_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_organizers ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is an activity organizer
CREATE OR REPLACE FUNCTION public.is_activity_organizer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activity_organizers WHERE user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- RLS: recreational_activities
CREATE POLICY "Authenticated users can view activities"
  ON public.recreational_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Organizers can create activities"
  ON public.recreational_activities FOR INSERT
  TO authenticated
  WITH CHECK (is_activity_organizer(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Organizers can update own activities"
  ON public.recreational_activities FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by AND is_activity_organizer(auth.uid()));

CREATE POLICY "Organizers can delete own activities"
  ON public.recreational_activities FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by AND is_activity_organizer(auth.uid()));

CREATE POLICY "Super admin can manage all activities"
  ON public.recreational_activities FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS: activity_responses
CREATE POLICY "Authenticated users can view responses"
  ON public.activity_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own response"
  ON public.activity_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own response"
  ON public.activity_responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own response"
  ON public.activity_responses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: activity_organizers
CREATE POLICY "Authenticated can view organizers"
  ON public.activity_organizers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can manage organizers"
  ON public.activity_organizers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Realtime for responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recreational_activities;
