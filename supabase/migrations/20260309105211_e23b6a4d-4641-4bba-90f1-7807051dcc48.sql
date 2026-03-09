
INSERT INTO public.app_settings (key, value) VALUES ('kiosk_enabled', 'true'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('kiosk_message', '""'::jsonb) ON CONFLICT (key) DO NOTHING;
