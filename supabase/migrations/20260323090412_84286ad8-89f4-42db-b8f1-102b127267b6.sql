
CREATE TABLE public.ip_bypass_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_bypass_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage ip_bypass_users"
  ON public.ip_bypass_users FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated can view ip_bypass_users"
  ON public.ip_bypass_users FOR SELECT
  TO authenticated
  USING (true);

-- Security definer function for edge function to check bypass without JWT auth
CREATE OR REPLACE FUNCTION public.is_ip_bypass_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ip_bypass_users WHERE user_id = _user_id
  )
$$;
