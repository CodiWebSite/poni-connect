CREATE OR REPLACE FUNCTION public.can_access_doctoral_forum(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'doctorand')
     OR public.can_manage_doctoral(_user_id)
     OR public.is_doctoral_coordinator(_user_id)
$$;

CREATE TABLE public.doctoral_forum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'discutie',
  is_pinned boolean NOT NULL DEFAULT false,
  is_resolved boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.doctoral_forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.doctoral_forum_topics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  is_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.doctoral_forum_likes (
  topic_id uuid NOT NULL REFERENCES public.doctoral_forum_topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, user_id)
);

CREATE INDEX idx_dft_activity ON public.doctoral_forum_topics (is_pinned DESC, last_activity_at DESC);
CREATE INDEX idx_dfr_topic ON public.doctoral_forum_replies (topic_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctoral_forum_topics TO authenticated;
GRANT ALL ON public.doctoral_forum_topics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctoral_forum_replies TO authenticated;
GRANT ALL ON public.doctoral_forum_replies TO service_role;
GRANT SELECT, INSERT, DELETE ON public.doctoral_forum_likes TO authenticated;
GRANT ALL ON public.doctoral_forum_likes TO service_role;

ALTER TABLE public.doctoral_forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctoral_forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctoral_forum_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctoral members view topics" ON public.doctoral_forum_topics FOR SELECT TO authenticated USING (public.can_access_doctoral_forum(auth.uid()));
CREATE POLICY "Doctoral members create topics" ON public.doctoral_forum_topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.can_access_doctoral_forum(auth.uid()));
CREATE POLICY "Authors update own topics" ON public.doctoral_forum_topics FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.can_manage_doctoral(auth.uid())) WITH CHECK (true);
CREATE POLICY "Authors delete own topics" ON public.doctoral_forum_topics FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.can_manage_doctoral(auth.uid()));

CREATE POLICY "Doctoral members view replies" ON public.doctoral_forum_replies FOR SELECT TO authenticated USING (public.can_access_doctoral_forum(auth.uid()));
CREATE POLICY "Doctoral members create replies" ON public.doctoral_forum_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.can_access_doctoral_forum(auth.uid()));
CREATE POLICY "Authors update own replies" ON public.doctoral_forum_replies FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.can_manage_doctoral(auth.uid())) WITH CHECK (true);
CREATE POLICY "Authors delete own replies" ON public.doctoral_forum_replies FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.can_manage_doctoral(auth.uid()));

CREATE POLICY "Doctoral members view likes" ON public.doctoral_forum_likes FOR SELECT TO authenticated USING (public.can_access_doctoral_forum(auth.uid()));
CREATE POLICY "Doctoral members like" ON public.doctoral_forum_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.can_access_doctoral_forum(auth.uid()));
CREATE POLICY "Doctoral members unlike" ON public.doctoral_forum_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.dft_reply_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.doctoral_forum_topics
      SET reply_count = reply_count + 1, last_activity_at = now()
      WHERE id = NEW.topic_id;
    RETURN NEW;
  ELSE
    UPDATE public.doctoral_forum_topics
      SET reply_count = GREATEST(0, reply_count - 1)
      WHERE id = OLD.topic_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_dft_reply_counters
AFTER INSERT OR DELETE ON public.doctoral_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.dft_reply_counters();

CREATE OR REPLACE FUNCTION public.dft_like_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.doctoral_forum_topics SET like_count = like_count + 1 WHERE id = NEW.topic_id;
    RETURN NEW;
  ELSE
    UPDATE public.doctoral_forum_topics SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.topic_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_dft_like_counters
AFTER INSERT OR DELETE ON public.doctoral_forum_likes
FOR EACH ROW EXECUTE FUNCTION public.dft_like_counters();

CREATE TRIGGER trg_dft_touch BEFORE UPDATE ON public.doctoral_forum_topics
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_dfr_touch BEFORE UPDATE ON public.doctoral_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();