
-- Table for public profile customization
CREATE TABLE public.public_profile_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epd_id uuid NOT NULL UNIQUE REFERENCES public.employee_personal_data(id) ON DELETE CASCADE,
  phone text,
  bio text,
  tagline text,
  researchgate_url text,
  google_scholar_url text,
  orcid_url text,
  website_url text,
  show_phone boolean NOT NULL DEFAULT true,
  show_email boolean NOT NULL DEFAULT true,
  show_department boolean NOT NULL DEFAULT true,
  show_position boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.public_profile_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can view public profiles
CREATE POLICY "Anon can view public profiles"
  ON public.public_profile_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can manage their own public profile (via employee_record linkage)
CREATE POLICY "Users can manage own public profile"
  ON public.public_profile_settings
  FOR ALL
  TO authenticated
  USING (
    epd_id IN (
      SELECT epd.id FROM employee_personal_data epd
      JOIN employee_records er ON er.id = epd.employee_record_id
      WHERE er.user_id = auth.uid()
    )
  )
  WITH CHECK (
    epd_id IN (
      SELECT epd.id FROM employee_personal_data epd
      JOIN employee_records er ON er.id = epd.employee_record_id
      WHERE er.user_id = auth.uid()
    )
  );

-- HR can manage all public profiles
CREATE POLICY "HR can manage all public profiles"
  ON public.public_profile_settings
  FOR ALL
  TO authenticated
  USING (can_manage_hr(auth.uid()))
  WITH CHECK (can_manage_hr(auth.uid()));
