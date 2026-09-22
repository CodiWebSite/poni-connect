CREATE TABLE IF NOT EXISTS public.inventory_pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  equipment_id uuid,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_pin_attempts_ip_time_idx
  ON public.inventory_pin_attempts (ip, created_at DESC);

GRANT ALL ON public.inventory_pin_attempts TO service_role;
ALTER TABLE public.inventory_pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pin attempts"
ON public.inventory_pin_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT ON public.inventory_pin_attempts TO authenticated;