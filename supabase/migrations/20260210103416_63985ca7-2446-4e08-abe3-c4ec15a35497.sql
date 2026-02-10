
-- Table for pre-assigned roles (before account creation)
CREATE TABLE public.pre_assigned_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.pre_assigned_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage pre-assigned roles"
  ON public.pre_assigned_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Update handle_new_user to check pre-assigned roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pre_role app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email));
  
  -- Check for pre-assigned role
  SELECT role INTO pre_role
  FROM public.pre_assigned_roles
  WHERE LOWER(email) = LOWER(new.email)
  LIMIT 1;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, COALESCE(pre_role, 'user'));
  
  -- Clean up pre-assigned role after use
  IF pre_role IS NOT NULL THEN
    DELETE FROM public.pre_assigned_roles WHERE LOWER(email) = LOWER(new.email);
  END IF;
  
  RETURN new;
END;
$$;
