
-- 1. Fix notification triggers (author_id, not user_id)
CREATE OR REPLACE FUNCTION public.notify_social_post_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_author_id uuid; v_name text;
BEGIN
  SELECT author_id INTO v_author_id FROM public.social_posts WHERE id = NEW.post_id;
  IF v_author_id IS NULL OR v_author_id = NEW.author_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, 'Un coleg') INTO v_name FROM public.profiles WHERE user_id = NEW.author_id;
  INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
  VALUES (v_author_id, 'Comentariu nou la postarea ta', v_name || ': ' || LEFT(NEW.content, 120), 'info', 'social_post', NEW.post_id::text);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_social_post_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_author_id uuid; v_name text;
BEGIN
  SELECT author_id INTO v_author_id FROM public.social_posts WHERE id = NEW.post_id;
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, 'Un coleg') INTO v_name FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
  VALUES (v_author_id, 'Reacție nouă la postarea ta', v_name || ' a reacționat la postarea ta', 'info', 'social_post', NEW.post_id::text);
  RETURN NEW;
END $$;

-- 2. Add reaction type to social_post_likes
DO $$ BEGIN
  CREATE TYPE public.social_reaction_type AS ENUM ('like','love','haha','wow','sad','angry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.social_post_likes
  ADD COLUMN IF NOT EXISTS reaction public.social_reaction_type NOT NULL DEFAULT 'like';

-- 3. Attachments table
CREATE TABLE IF NOT EXISTS public.social_post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  mime_type text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('image','gif','document')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_post_attachments_post_idx ON public.social_post_attachments(post_id);

GRANT SELECT, INSERT, DELETE ON public.social_post_attachments TO authenticated;
GRANT ALL ON public.social_post_attachments TO service_role;

ALTER TABLE public.social_post_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_select" ON public.social_post_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.social_posts p WHERE p.id = post_id
    AND (
      p.community_id IS NULL
      OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = p.community_id AND c.visibility = 'public')
      OR public.is_community_member(p.community_id, auth.uid())
      OR public.can_manage_communities(auth.uid())
    )
));

CREATE POLICY "att_insert_own" ON public.social_post_attachments FOR INSERT TO authenticated
WITH CHECK (uploader_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND p.author_id = auth.uid())
);

CREATE POLICY "att_delete" ON public.social_post_attachments FOR DELETE TO authenticated
USING (uploader_id = auth.uid() OR public.can_manage_communities(auth.uid()));
