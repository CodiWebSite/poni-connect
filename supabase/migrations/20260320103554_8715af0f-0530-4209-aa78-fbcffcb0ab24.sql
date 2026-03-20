
-- Custom roles table
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'bg-gray-500 text-white',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view custom roles"
  ON public.custom_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admin can manage custom roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- User-custom-role assignments
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  custom_role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, custom_role_id)
);

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view user custom roles"
  ON public.user_custom_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admin can manage user custom roles"
  ON public.user_custom_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
