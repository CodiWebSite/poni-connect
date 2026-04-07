
-- Create enums (may already exist from failed migration partial)
DO $$ BEGIN
  CREATE TYPE public.suggestion_status AS ENUM ('new', 'in_review', 'approved', 'in_progress', 'implemented', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.suggestion_type AS ENUM ('idea', 'feedback', 'problem', 'improvement');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.suggestion_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop ALL existing policies on suggestions first
DROP POLICY IF EXISTS "Users can view own suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can insert suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Admins can view all suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Admins can update suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can delete own pending suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can update own pending suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Authenticated users can view suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Authenticated users can create suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Super admins can update any suggestion" ON public.suggestions;
DROP POLICY IF EXISTS "Users can update own suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can delete own new suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Super admins can delete any suggestion" ON public.suggestions;

-- Now safe to alter user_id nullable
ALTER TABLE public.suggestions ALTER COLUMN user_id DROP NOT NULL;

-- Add new columns (idempotent)
ALTER TABLE public.suggestions 
  ADD COLUMN IF NOT EXISTS type suggestion_type NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS priority suggestion_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS target_module TEXT,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;

-- Rename responded columns (may already be renamed)
DO $$ BEGIN
  ALTER TABLE public.suggestions RENAME COLUMN responded_by TO admin_responded_by;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.suggestions RENAME COLUMN responded_at TO admin_responded_at;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Convert status: add temp, migrate data, drop old with CASCADE, rename
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS status_new suggestion_status NOT NULL DEFAULT 'new';

UPDATE public.suggestions SET status_new = CASE 
  WHEN status::text = 'pending' THEN 'new'::suggestion_status
  WHEN status::text = 'reviewed' THEN 'in_review'::suggestion_status
  WHEN status::text = 'implemented' THEN 'implemented'::suggestion_status
  WHEN status::text = 'rejected' THEN 'rejected'::suggestion_status
  ELSE 'new'::suggestion_status
END WHERE status IS NOT NULL;

ALTER TABLE public.suggestions DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE public.suggestions RENAME COLUMN status_new TO status;

ALTER TABLE public.suggestions ALTER COLUMN category SET DEFAULT 'Alte idei';

-- Create votes table
CREATE TABLE IF NOT EXISTS public.suggestion_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Create comments table
CREATE TABLE IF NOT EXISTS public.suggestion_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suggestion_comments ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_suggestions_updated_at') THEN
    CREATE TRIGGER update_suggestions_updated_at
      BEFORE UPDATE ON public.suggestions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- RLS for suggestions
CREATE POLICY "Authenticated users can view suggestions"
  ON public.suggestions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create suggestions"
  ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_anonymous = true);

CREATE POLICY "Super admins can update any suggestion"
  ON public.suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can update own suggestions"
  ON public.suggestions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_anonymous = false);

CREATE POLICY "Users can delete own new suggestions"
  ON public.suggestions FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'new');

CREATE POLICY "Super admins can delete any suggestion"
  ON public.suggestions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS for votes
DROP POLICY IF EXISTS "Authenticated users can view votes" ON public.suggestion_votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.suggestion_votes;
DROP POLICY IF EXISTS "Users can remove own vote" ON public.suggestion_votes;

CREATE POLICY "Authenticated users can view votes"
  ON public.suggestion_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can vote"
  ON public.suggestion_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own vote"
  ON public.suggestion_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS for comments
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.suggestion_comments;
DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.suggestion_comments;
DROP POLICY IF EXISTS "Super admins can delete comments" ON public.suggestion_comments;

CREATE POLICY "Authenticated users can view comments"
  ON public.suggestion_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can add comments"
  ON public.suggestion_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can delete comments"
  ON public.suggestion_comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Vote count trigger
CREATE OR REPLACE FUNCTION public.update_suggestion_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE suggestions SET vote_count = vote_count + 1 WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE suggestions SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_vote_count ON public.suggestion_votes;
CREATE TRIGGER trigger_update_vote_count
  AFTER INSERT OR DELETE ON public.suggestion_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_vote_count();

-- Comment count trigger
CREATE OR REPLACE FUNCTION public.update_suggestion_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE suggestions SET comment_count = comment_count + 1 WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE suggestions SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_comment_count ON public.suggestion_comments;
CREATE TRIGGER trigger_update_comment_count
  AFTER INSERT OR DELETE ON public.suggestion_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_comment_count();

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_category ON public.suggestions(category);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON public.suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON public.suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion ON public.suggestion_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_comments_suggestion ON public.suggestion_comments(suggestion_id);
