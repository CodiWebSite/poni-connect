
-- Extend equipment_items with new columns
ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS floor integer,
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS brand_model text,
  ADD COLUMN IF NOT EXISTS inventory_number text,
  ADD COLUMN IF NOT EXISTS qr_pin_hash text;

-- Add unique constraint on inventory_number (only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS equipment_items_inventory_number_key ON public.equipment_items (inventory_number) WHERE inventory_number IS NOT NULL;

-- Create equipment_software table
CREATE TABLE IF NOT EXISTS public.equipment_software (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES public.equipment_items(id) ON DELETE CASCADE NOT NULL,
  activity_type text,
  pc_name text,
  os text,
  license_year integer,
  license_type text,
  antivirus text,
  antivirus_year integer,
  installed_apps text,
  licensed_count text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_software ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access on equipment_software"
  ON public.equipment_software FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Create equipment_pin_settings table
CREATE TABLE IF NOT EXISTS public.equipment_pin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_pin_hash text,
  max_attempts integer NOT NULL DEFAULT 3,
  lockout_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_pin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access on equipment_pin_settings"
  ON public.equipment_pin_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
