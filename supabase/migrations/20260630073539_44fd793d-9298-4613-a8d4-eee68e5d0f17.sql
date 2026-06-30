
-- Social posts
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select" ON public.social_posts FOR SELECT TO authenticated
USING (
  community_id IS NULL
  OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.visibility = 'public')
  OR public.is_community_member(community_id, auth.uid())
  OR public.can_manage_communities(auth.uid())
);
CREATE POLICY "posts_insert" ON public.social_posts FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    community_id IS NULL
    OR public.is_community_member(community_id, auth.uid())
    OR public.can_manage_communities(auth.uid())
  )
);
CREATE POLICY "posts_update_own" ON public.social_posts FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts_delete" ON public.social_posts FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR public.can_manage_communities(auth.uid())
  OR (community_id IS NOT NULL AND public.is_community_admin(community_id, auth.uid()))
);

CREATE INDEX social_posts_community_idx ON public.social_posts(community_id, created_at DESC);
CREATE INDEX social_posts_created_idx ON public.social_posts(created_at DESC);

CREATE TRIGGER social_posts_touch BEFORE UPDATE ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Likes
CREATE TABLE public.social_post_likes (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.social_post_likes TO authenticated;
GRANT ALL ON public.social_post_likes TO service_role;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select" ON public.social_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert_own" ON public.social_post_likes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes_delete_own" ON public.social_post_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Comments
CREATE TABLE public.social_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_comments TO authenticated;
GRANT ALL ON public.social_post_comments TO service_role;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.social_post_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id));
CREATE POLICY "comments_insert_own" ON public.social_post_comments FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_update_own" ON public.social_post_comments FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_delete" ON public.social_post_comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.can_manage_communities(auth.uid()));

CREATE INDEX social_comments_post_idx ON public.social_post_comments(post_id, created_at);

-- Triggers to keep counts
CREATE OR REPLACE FUNCTION public.social_post_like_count_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER social_post_likes_count
AFTER INSERT OR DELETE ON public.social_post_likes
FOR EACH ROW EXECUTE FUNCTION public.social_post_like_count_trg();

CREATE OR REPLACE FUNCTION public.social_post_comment_count_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER social_post_comments_count
AFTER INSERT OR DELETE ON public.social_post_comments
FOR EACH ROW EXECUTE FUNCTION public.social_post_comment_count_trg();
