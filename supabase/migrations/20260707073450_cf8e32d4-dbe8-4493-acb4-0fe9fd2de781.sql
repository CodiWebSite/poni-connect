
-- 1. Enum
ALTER TYPE public.community_member_role ADD VALUE IF NOT EXISTS 'moderator';

-- 2. Coloane
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS rules text,
  ADD COLUMN IF NOT EXISTS long_description text;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS shared_from_post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_pinned ON public.social_posts(community_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_social_posts_shared_from ON public.social_posts(shared_from_post_id) WHERE shared_from_post_id IS NOT NULL;

ALTER TABLE public.social_post_comments
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- 3. Helper (cast la text ca să evităm eroarea enum)
CREATE OR REPLACE FUNCTION public.is_community_moderator(_community_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = _community_id AND user_id = _user_id
      AND role::text IN ('admin','moderator')
  );
$$;

-- 4. community_join_requests
CREATE TABLE IF NOT EXISTS public.community_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_join_requests TO authenticated;
GRANT ALL ON public.community_join_requests TO service_role;

ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY cjr_select ON public.community_join_requests FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.is_community_moderator(community_id, auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);
CREATE POLICY cjr_insert_self ON public.community_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY cjr_update_owner ON public.community_join_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND status IN ('pending','cancelled'));
CREATE POLICY cjr_update_mod ON public.community_join_requests FOR UPDATE TO authenticated
  USING (public.is_community_moderator(community_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.is_community_moderator(community_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_cjr_updated BEFORE UPDATE ON public.community_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_community_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_name text; v_req_name text;
BEGIN
  SELECT name INTO v_name FROM public.communities WHERE id = NEW.community_id;
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(full_name, 'Un coleg') INTO v_req_name FROM public.profiles WHERE user_id = NEW.user_id;
    FOR r IN SELECT user_id FROM public.community_members WHERE community_id = NEW.community_id AND role::text IN ('admin','moderator') LOOP
      INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
      VALUES (r.user_id, 'Cerere de aderare',
        v_req_name || ' vrea să se alăture comunității "' || COALESCE(v_name,'') || '"',
        'info', 'community_join_request', NEW.id);
    END LOOP;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved','rejected') THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (NEW.user_id,
      CASE WHEN NEW.status='approved' THEN 'Cerere aprobată' ELSE 'Cerere respinsă' END,
      'Cererea ta pentru comunitatea "' || COALESCE(v_name,'') || '" a fost ' ||
        CASE WHEN NEW.status='approved' THEN 'aprobată' ELSE 'respinsă' END || '.',
      CASE WHEN NEW.status='approved' THEN 'success' ELSE 'warning' END,
      'community_join_request', NEW.id);
    IF NEW.status = 'approved' THEN
      INSERT INTO public.community_members (community_id, user_id, role)
      VALUES (NEW.community_id, NEW.user_id, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_cjr AFTER INSERT OR UPDATE ON public.community_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_join_request();

-- 5. community_invitations
CREATE TABLE IF NOT EXISTS public.community_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, invitee_id, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_invitations TO authenticated;
GRANT ALL ON public.community_invitations TO service_role;

ALTER TABLE public.community_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ci_select ON public.community_invitations FOR SELECT TO authenticated USING (
  invitee_id = auth.uid() OR inviter_id = auth.uid()
  OR public.is_community_moderator(community_id, auth.uid())
  OR public.has_role(auth.uid(),'super_admin')
);
CREATE POLICY ci_insert_mod ON public.community_invitations FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND public.is_community_moderator(community_id, auth.uid()));
CREATE POLICY ci_update_invitee ON public.community_invitations FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid()) WITH CHECK (invitee_id = auth.uid() AND status IN ('accepted','declined'));
CREATE POLICY ci_update_inviter ON public.community_invitations FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid() OR public.is_community_moderator(community_id, auth.uid()))
  WITH CHECK (inviter_id = auth.uid() OR public.is_community_moderator(community_id, auth.uid()));

CREATE TRIGGER trg_ci_updated BEFORE UPDATE ON public.community_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_community_invitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  SELECT name INTO v_name FROM public.communities WHERE id = NEW.community_id;
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (NEW.invitee_id, 'Invitație într-o comunitate',
      'Ai fost invitat să te alături comunității "' || COALESCE(v_name,'') || '"',
      'info', 'community_invitation', NEW.id);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (NEW.community_id, NEW.invitee_id, 'member')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ci AFTER INSERT OR UPDATE ON public.community_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_invitation();

-- 6. social_post_bookmarks
CREATE TABLE IF NOT EXISTS public.social_post_bookmarks (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.social_post_bookmarks TO authenticated;
GRANT ALL ON public.social_post_bookmarks TO service_role;
ALTER TABLE public.social_post_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY spb_own ON public.social_post_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. social_post_mentions
CREATE TABLE IF NOT EXISTS public.social_post_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.social_post_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  mentioned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_spm_user ON public.social_post_mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spm_post ON public.social_post_mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_spm_comment ON public.social_post_mentions(comment_id);

GRANT SELECT, INSERT, DELETE ON public.social_post_mentions TO authenticated;
GRANT ALL ON public.social_post_mentions TO service_role;
ALTER TABLE public.social_post_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY spm_select ON public.social_post_mentions FOR SELECT TO authenticated USING (
  mentioned_user_id = auth.uid()
  OR mentioned_by = auth.uid()
  OR public.has_role(auth.uid(),'super_admin')
);
CREATE POLICY spm_insert ON public.social_post_mentions FOR INSERT TO authenticated
  WITH CHECK (mentioned_by = auth.uid());
CREATE POLICY spm_delete ON public.social_post_mentions FOR DELETE TO authenticated
  USING (mentioned_by = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_social_mention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor text;
BEGIN
  IF NEW.mentioned_user_id = NEW.mentioned_by THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, 'Cineva') INTO v_actor FROM public.profiles WHERE user_id = NEW.mentioned_by;
  INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
  VALUES (NEW.mentioned_user_id, 'Ai fost menționat',
    v_actor || ' te-a menționat ' || CASE WHEN NEW.comment_id IS NOT NULL THEN 'într-un comentariu' ELSE 'într-o postare' END,
    'info',
    CASE WHEN NEW.comment_id IS NOT NULL THEN 'social_comment_mention' ELSE 'social_post_mention' END,
    COALESCE(NEW.comment_id, NEW.post_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_mention AFTER INSERT ON public.social_post_mentions
  FOR EACH ROW EXECUTE FUNCTION public.notify_social_mention();

-- 8. Pin/moderare postări în comunitate
DROP POLICY IF EXISTS social_posts_update_mod ON public.social_posts;
CREATE POLICY social_posts_update_mod ON public.social_posts FOR UPDATE TO authenticated
  USING (
    community_id IS NOT NULL AND (
      public.is_community_moderator(community_id, auth.uid())
      OR public.has_role(auth.uid(),'super_admin')
    )
  )
  WITH CHECK (
    community_id IS NOT NULL AND (
      public.is_community_moderator(community_id, auth.uid())
      OR public.has_role(auth.uid(),'super_admin')
    )
  );
