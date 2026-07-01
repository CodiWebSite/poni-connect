
-- 1. Org chart nodes
CREATE TABLE IF NOT EXISTS public.org_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text,
  department text,
  parent_id uuid REFERENCES public.org_nodes(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  avatar_url text,
  order_index int NOT NULL DEFAULT 0,
  is_root boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_nodes TO authenticated;
GRANT ALL ON public.org_nodes TO service_role;

ALTER TABLE public.org_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view org nodes"
  ON public.org_nodes FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR/admin can insert org nodes"
  ON public.org_nodes FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_hr(auth.uid()) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "HR/admin can update org nodes"
  ON public.org_nodes FOR UPDATE TO authenticated
  USING (public.can_manage_hr(auth.uid()) OR public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.can_manage_hr(auth.uid()) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "HR/admin can delete org nodes"
  ON public.org_nodes FOR DELETE TO authenticated
  USING (public.can_manage_hr(auth.uid()) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS org_nodes_parent_idx ON public.org_nodes(parent_id);
CREATE INDEX IF NOT EXISTS org_nodes_user_idx ON public.org_nodes(user_id);

CREATE TRIGGER trg_org_nodes_updated
  BEFORE UPDATE ON public.org_nodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Birthday opt-in on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_birthday_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hire_date date;

-- 3. Social settings KV
CREATE TABLE IF NOT EXISTS public.social_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_settings TO authenticated;
GRANT ALL ON public.social_settings TO service_role;

ALTER TABLE public.social_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read social settings"
  ON public.social_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR/admin can upsert social settings"
  ON public.social_settings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_hr(auth.uid()) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "HR/admin can update social settings"
  ON public.social_settings FOR UPDATE TO authenticated
  USING (public.can_manage_hr(auth.uid()) OR public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.can_manage_hr(auth.uid()) OR public.has_role(auth.uid(),'super_admin'::app_role));

GRANT INSERT, UPDATE ON public.social_settings TO authenticated;

-- Seed default toggles
INSERT INTO public.social_settings (key, value) VALUES
  ('allow_announcements_all', '{"enabled": false}'::jsonb),
  ('public_leave_calendar', '{"enabled": true}'::jsonb),
  ('public_remote_calendar', '{"enabled": false}'::jsonb),
  ('public_work_schedule', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Trigger: notify post author when someone comments
CREATE OR REPLACE FUNCTION public.notify_social_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_commenter_name text;
BEGIN
  SELECT user_id INTO v_author_id FROM public.social_posts WHERE id = NEW.post_id;
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Un coleg') INTO v_commenter_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
  VALUES (
    v_author_id,
    'Comentariu nou la postarea ta',
    v_commenter_name || ': ' || LEFT(NEW.content, 120),
    'info',
    'social_post',
    NEW.post_id::text
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_social_post_comment ON public.social_post_comments;
CREATE TRIGGER trg_notify_social_post_comment
  AFTER INSERT ON public.social_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_social_post_comment();

-- 5. Trigger: notify post author on like (only new likes)
CREATE OR REPLACE FUNCTION public.notify_social_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_liker_name text;
BEGIN
  SELECT user_id INTO v_author_id FROM public.social_posts WHERE id = NEW.post_id;
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Un coleg') INTO v_liker_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
  VALUES (
    v_author_id,
    'Reacție nouă la postarea ta',
    v_liker_name || ' a apreciat postarea ta',
    'info',
    'social_post',
    NEW.post_id::text
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_social_post_like ON public.social_post_likes;
CREATE TRIGGER trg_notify_social_post_like
  AFTER INSERT ON public.social_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_social_post_like();
