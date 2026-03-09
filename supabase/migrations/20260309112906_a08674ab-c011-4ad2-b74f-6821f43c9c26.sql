INSERT INTO public.app_settings (key, value)
VALUES ('kiosk_ticker_messages', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;