-- Fix social notification functions: notifications.related_id is uuid, not text
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

-- Add threaded comments support
ALTER TABLE public.social_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.social_post_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reaction_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_social_post_comments_parent
  ON public.social_post_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_post_parent_created
  ON public.social_post_comments(post_id, parent_comment_id, created_at);

CREATE OR REPLACE FUNCTION public.validate_social_comment_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_post_id uuid;
  v_parent_parent_id uuid;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT post_id, parent_comment_id
  INTO v_parent_post_id, v_parent_parent_id
  FROM public.social_post_comments
  WHERE id = NEW.parent_comment_id;

  IF v_parent_post_id IS NULL THEN
    RAISE EXCEPTION 'Comentariul părinte nu există.';
  END IF;

  IF v_parent_post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'Răspunsul trebuie să fie la aceeași postare.';
  END IF;

  IF v_parent_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Răspunsurile sunt permise pe un singur nivel.';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS validate_social_comment_thread_trigger ON public.social_post_comments;
CREATE TRIGGER validate_social_comment_thread_trigger
BEFORE INSERT OR UPDATE OF post_id, parent_comment_id ON public.social_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.validate_social_comment_thread();

-- Comment reactions
CREATE TABLE IF NOT EXISTS public.social_comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.social_post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction public.social_reaction_type NOT NULL DEFAULT 'like',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comment_reactions TO authenticated;
GRANT ALL ON public.social_comment_reactions TO service_role;

ALTER TABLE public.social_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reactions_select" ON public.social_comment_reactions;
CREATE POLICY "comment_reactions_select"
ON public.social_comment_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.social_post_comments c
    JOIN public.social_posts p ON p.id = c.post_id
    WHERE c.id = social_comment_reactions.comment_id
  )
);

DROP POLICY IF EXISTS "comment_reactions_insert_own" ON public.social_comment_reactions;
CREATE POLICY "comment_reactions_insert_own"
ON public.social_comment_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.social_post_comments c
    JOIN public.social_posts p ON p.id = c.post_id
    WHERE c.id = social_comment_reactions.comment_id
  )
);

DROP POLICY IF EXISTS "comment_reactions_update_own" ON public.social_comment_reactions;
CREATE POLICY "comment_reactions_update_own"
ON public.social_comment_reactions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comment_reactions_delete_own" ON public.social_comment_reactions;
CREATE POLICY "comment_reactions_delete_own"
ON public.social_comment_reactions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.social_comment_reaction_count_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_post_comments
    SET reaction_count = reaction_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_post_comments
    SET reaction_count = GREATEST(reaction_count - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS social_comment_reaction_count_trigger ON public.social_comment_reactions;
CREATE TRIGGER social_comment_reaction_count_trigger
AFTER INSERT OR DELETE ON public.social_comment_reactions
FOR EACH ROW
EXECUTE FUNCTION public.social_comment_reaction_count_trg();

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

DROP TRIGGER IF EXISTS notify_social_comment_reaction_trigger ON public.social_comment_reactions;
CREATE TRIGGER notify_social_comment_reaction_trigger
AFTER INSERT ON public.social_comment_reactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_social_comment_reaction();