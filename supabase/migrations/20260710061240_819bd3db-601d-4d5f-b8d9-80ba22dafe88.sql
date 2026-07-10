
CREATE TABLE public.leave_replacement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_epd_id uuid NOT NULL REFERENCES public.employee_personal_data(id) ON DELETE CASCADE,
  replacement_epd_id uuid NOT NULL REFERENCES public.employee_personal_data(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_epd_id, replacement_epd_id),
  CHECK (employee_epd_id <> replacement_epd_id)
);

GRANT SELECT ON public.leave_replacement_overrides TO authenticated;
GRANT ALL ON public.leave_replacement_overrides TO service_role;

ALTER TABLE public.leave_replacement_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read replacement overrides"
  ON public.leave_replacement_overrides FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "HR can manage replacement overrides"
  ON public.leave_replacement_overrides FOR ALL
  TO authenticated
  USING (public.can_manage_hr(auth.uid()))
  WITH CHECK (public.can_manage_hr(auth.uid()));
