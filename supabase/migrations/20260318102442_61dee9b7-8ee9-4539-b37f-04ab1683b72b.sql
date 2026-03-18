ALTER TABLE public.public_profile_settings
  ADD COLUMN IF NOT EXISTS bio_en text,
  ADD COLUMN IF NOT EXISTS tagline_en text,
  ADD COLUMN IF NOT EXISTS position_en text,
  ADD COLUMN IF NOT EXISTS department_en text;