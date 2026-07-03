ALTER TABLE public.social_post_comments
ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.social_post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_social_post_comments_parent_comment_id
ON public.social_post_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_post_parent
ON public.social_post_comments(post_id, parent_comment_id, created_at);

CREATE TABLE IF NOT EXISTS public.social_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.social_post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comment_reactions TO authenticated;
GRANT ALL ON public.social_comment_reactions TO service_role;

ALTER TABLE public.social_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comment reactions are viewable by authenticated users" ON public.social_comment_reactions;
CREATE POLICY "Comment reactions are viewable by authenticated users"
ON public.social_comment_reactions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users manage own comment reactions" ON public.social_comment_reactions;
CREATE POLICY "Users manage own comment reactions"
ON public.social_comment_reactions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

INSERT INTO public.social_settings (key, value) VALUES
  ('social_notifications_post_comments', '{"enabled": true}'::jsonb),
  ('social_notifications_comment_replies', '{"enabled": true}'::jsonb),
  ('social_notifications_post_reactions', '{"enabled": true}'::jsonb),
  ('social_notifications_comment_reactions', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.social_setting_enabled(_key text, _default boolean DEFAULT true)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean FROM public.social_settings WHERE key = _key),
    _default
  );
$function$;

CREATE OR REPLACE FUNCTION public.notify_social_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_post_author_id uuid;
  v_parent_author_id uuid;
  v_name text;
BEGIN
  SELECT author_id INTO v_post_author_id
  FROM public.social_posts
  WHERE id = NEW.post_id;

  SELECT COALESCE(full_name, 'Un coleg') INTO v_name
  FROM public.profiles
  WHERE user_id = NEW.author_id;

  IF NEW.parent_comment_id IS NOT NULL THEN
    IF NOT public.social_setting_enabled('social_notifications_comment_replies', true) THEN
      RETURN NEW;
    END IF;

    SELECT author_id INTO v_parent_author_id
    FROM public.social_post_comments
    WHERE id = NEW.parent_comment_id;

    IF v_parent_author_id IS NOT NULL AND v_parent_author_id <> NEW.author_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
      VALUES (
        v_parent_author_id,
        'Răspuns nou la comentariul tău',
        v_name || ': ' || LEFT(NEW.content, 120),
        'info',
        'social_post',
        NEW.post_id
      );
    END IF;
  ELSIF v_post_author_id IS NOT NULL AND v_post_author_id <> NEW.author_id THEN
    IF NOT public.social_setting_enabled('social_notifications_post_comments', true) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      v_post_author_id,
      'Comentariu nou la postarea ta',
      v_name || ': ' || LEFT(NEW.content, 120),
      'info',
      'social_post',
      NEW.post_id
    );
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_notify_social_post_comment ON public.social_post_comments;
CREATE TRIGGER trg_notify_social_post_comment
AFTER INSERT ON public.social_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_social_post_comment();

CREATE OR REPLACE FUNCTION public.notify_social_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_author_id uuid;
  v_name text;
BEGIN
  IF NOT public.social_setting_enabled('social_notifications_post_reactions', true) THEN
    RETURN NEW;
  END IF;

  SELECT author_id INTO v_author_id
  FROM public.social_posts
  WHERE id = NEW.post_id;

  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Un coleg') INTO v_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
  VALUES (
    v_author_id,
    'Reacție nouă la postarea ta',
    v_name || ' a reacționat la postarea ta',
    'info',
    'social_post',
    NEW.post_id
  );

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_notify_social_post_like ON public.social_post_likes;
CREATE TRIGGER trg_notify_social_post_like
AFTER INSERT ON public.social_post_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_social_post_like();

CREATE OR REPLACE FUNCTION public.notify_social_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_comment_author_id uuid;
  v_post_id uuid;
  v_name text;
BEGIN
  IF NOT public.social_setting_enabled('social_notifications_comment_reactions', true) THEN
    RETURN NEW;
  END IF;

  SELECT author_id, post_id
  INTO v_comment_author_id, v_post_id
  FROM public.social_post_comments
  WHERE id = NEW.comment_id;

  IF v_comment_author_id IS NULL OR v_comment_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Un coleg') INTO v_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
  VALUES (
    v_comment_author_id,
    'Reacție nouă la comentariul tău',
    v_name || ' a reacționat la comentariul tău',
    'info',
    'social_post',
    v_post_id
  );

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_notify_social_comment_reaction ON public.social_comment_reactions;
CREATE TRIGGER trg_notify_social_comment_reaction
AFTER INSERT ON public.social_comment_reactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_social_comment_reaction();

CREATE OR REPLACE FUNCTION public.notify_admin_account_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role IN ('super_admin', 'hr', 'sef_srus')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      admin_record.user_id,
      'Cerere nouă de creare cont',
      NEW.full_name || ' (' || NEW.email || ') solicită ajutor pentru crearea contului.',
      'warning',
      'account_request',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admin_security_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role IN ('super_admin','sef_srus') LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      r.user_id,
      'Incident de securitate raportat',
      'Tip: ' || NEW.incident_type || ' — severitate: ' || NEW.severity,
      CASE WHEN NEW.severity IN ('high','critical') THEN 'warning' ELSE 'info' END,
      'incident_report',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END
$function$;