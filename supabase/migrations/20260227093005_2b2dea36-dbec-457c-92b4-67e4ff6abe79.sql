
CREATE TABLE public.maintenance_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.maintenance_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (even unauthenticated, since they're locked out)
CREATE POLICY "Anyone can subscribe" ON public.maintenance_subscribers
  FOR INSERT WITH CHECK (true);

-- Only admins can view/delete subscribers
CREATE POLICY "Admins can view subscribers" ON public.maintenance_subscribers
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete subscribers" ON public.maintenance_subscribers
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );
