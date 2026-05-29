CREATE TABLE public.user_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Semnătura mea',
  signature_data text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_signatures_user_id ON public.user_signatures(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_signatures TO authenticated;
GRANT ALL ON public.user_signatures TO service_role;

ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signatures"
ON public.user_signatures FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signatures"
ON public.user_signatures FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signatures"
ON public.user_signatures FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own signatures"
ON public.user_signatures FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_signatures_updated_at
BEFORE UPDATE ON public.user_signatures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();