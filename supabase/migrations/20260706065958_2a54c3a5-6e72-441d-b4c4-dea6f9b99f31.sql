
-- 1. Add avatar_url to communities
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Tighten SELECT policies: private communities and their members/posts are only visible to members (and super_admin for moderation). HR/sef_srus no longer bypass privacy.
DROP POLICY IF EXISTS communities_select_public_or_member ON public.communities;
CREATE POLICY communities_select_public_or_member ON public.communities
  FOR SELECT USING (
    visibility = 'public'::community_visibility
    OR public.is_community_member(id, auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS community_members_select ON public.community_members;
CREATE POLICY community_members_select ON public.community_members
  FOR SELECT USING (
    public.is_community_member(community_id, auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_members.community_id AND c.visibility = 'public'::community_visibility
    )
  );

DROP POLICY IF EXISTS posts_select ON public.social_posts;
CREATE POLICY posts_select ON public.social_posts
  FOR SELECT USING (
    community_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = social_posts.community_id AND c.visibility = 'public'::community_visibility
    )
    OR public.is_community_member(community_id, auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
