
CREATE TABLE public.medical_dossier_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epd_id uuid NOT NULL REFERENCES public.employee_personal_data(id) ON DELETE CASCADE,
  professional_training text,
  professional_route text,
  work_history jsonb DEFAULT '[]'::jsonb,
  current_activities text,
  professional_diseases boolean,
  professional_diseases_details text,
  work_accidents boolean,
  work_accidents_details text,
  family_doctor text,
  heredo_collateral text,
  personal_physiological text,
  personal_pathological text,
  smoking text,
  alcohol text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(epd_id)
);

ALTER TABLE public.medical_dossier_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor full access medical_dossier_data"
  ON public.medical_dossier_data
  FOR ALL
  TO authenticated
  USING (can_manage_medical(auth.uid()))
  WITH CHECK (can_manage_medical(auth.uid()));

CREATE POLICY "HR can view medical_dossier_data"
  ON public.medical_dossier_data
  FOR SELECT
  TO authenticated
  USING (can_view_medical_status(auth.uid()));
