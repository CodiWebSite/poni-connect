
-- =============================================
-- 1. Auth Login Logs
-- =============================================
CREATE TABLE public.auth_login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  device_summary text,
  login_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success',
  is_suspicious boolean NOT NULL DEFAULT false
);

ALTER TABLE public.auth_login_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can view all logs
CREATE POLICY "Super admin can view auth logs"
  ON public.auth_login_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Edge function inserts via service role, no RLS INSERT policy needed for anon
-- But we need INSERT for authenticated service-role calls
CREATE POLICY "Service can insert auth logs"
  ON public.auth_login_logs
  FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 2. Equipment Items
-- =============================================
CREATE TABLE public.equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'altele',
  serial_number text,
  description text,
  status text NOT NULL DEFAULT 'available',
  assigned_to_user_id uuid,
  assigned_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access equipment_items"
  ON public.equipment_items
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- =============================================
-- 3. Equipment History
-- =============================================
CREATE TABLE public.equipment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_user_id uuid,
  to_user_id uuid,
  performed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access equipment_history"
  ON public.equipment_history
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Update trigger for equipment_items
CREATE TRIGGER update_equipment_items_updated_at
  BEFORE UPDATE ON public.equipment_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
