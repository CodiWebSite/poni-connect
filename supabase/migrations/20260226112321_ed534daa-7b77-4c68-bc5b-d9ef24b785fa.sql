
INSERT INTO public.app_settings (key, value) VALUES 
  ('maintenance_mode', 'false'::jsonb),
  ('homepage_message', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
