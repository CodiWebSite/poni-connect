CREATE TABLE public.user_dashboard_layouts (
  user_id uuid PRIMARY KEY,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_layouts TO authenticated;
GRANT ALL ON public.user_dashboard_layouts TO service_role;
ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own dashboard layout select" ON public.user_dashboard_layouts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own dashboard layout insert" ON public.user_dashboard_layouts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own dashboard layout update" ON public.user_dashboard_layouts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own dashboard layout delete" ON public.user_dashboard_layouts FOR DELETE TO authenticated USING (user_id = auth.uid());