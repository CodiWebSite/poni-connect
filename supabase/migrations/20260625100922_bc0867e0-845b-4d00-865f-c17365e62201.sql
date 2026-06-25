
-- Visibility enum
DO $$ BEGIN
  CREATE TYPE public.community_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.community_member_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Communities
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  visibility public.community_visibility NOT NULL DEFAULT 'public',
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- Members
CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.community_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of given community?
CREATE OR REPLACE FUNCTION public.is_community_member(_community_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = _community_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin(_community_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = _community_id AND user_id = _user_id AND role = 'admin'
  );
$$;

-- Who can manage communities globally (create/edit any)
CREATE OR REPLACE FUNCTION public.can_manage_communities(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
      OR public.has_role(_user_id, 'hr'::app_role)
      OR public.has_role(_user_id, 'sef_srus'::app_role);
$$;

-- RLS: communities
CREATE POLICY "communities_select_public_or_member"
ON public.communities FOR SELECT
TO authenticated
USING (
  visibility = 'public'
  OR public.is_community_member(id, auth.uid())
  OR public.can_manage_communities(auth.uid())
);

CREATE POLICY "communities_insert_managers"
ON public.communities FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_communities(auth.uid()));

CREATE POLICY "communities_update_admin_or_manager"
ON public.communities FOR UPDATE
TO authenticated
USING (
  public.can_manage_communities(auth.uid())
  OR public.is_community_admin(id, auth.uid())
)
WITH CHECK (true);

CREATE POLICY "communities_delete_managers"
ON public.communities FOR DELETE
TO authenticated
USING (public.can_manage_communities(auth.uid()));

-- RLS: members
CREATE POLICY "community_members_select"
ON public.community_members FOR SELECT
TO authenticated
USING (
  public.is_community_member(community_id, auth.uid())
  OR public.can_manage_communities(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_id AND c.visibility = 'public'
  )
);

CREATE POLICY "community_members_insert_admin"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_communities(auth.uid())
  OR public.is_community_admin(community_id, auth.uid())
);

CREATE POLICY "community_members_delete_admin_or_self"
ON public.community_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_manage_communities(auth.uid())
  OR public.is_community_admin(community_id, auth.uid())
);

CREATE POLICY "community_members_update_admin"
ON public.community_members FOR UPDATE
TO authenticated
USING (
  public.can_manage_communities(auth.uid())
  OR public.is_community_admin(community_id, auth.uid())
)
WITH CHECK (true);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS communities_touch_updated_at ON public.communities;
CREATE TRIGGER communities_touch_updated_at
BEFORE UPDATE ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger: auto-add creator as admin member
CREATE OR REPLACE FUNCTION public.community_add_creator_as_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS communities_creator_admin ON public.communities;
CREATE TRIGGER communities_creator_admin
AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.community_add_creator_as_admin();
