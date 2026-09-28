ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS kiosk_until timestamptz DEFAULT (now() + interval '30 days');

UPDATE public.announcements
SET kiosk_until = created_at + interval '30 days'
WHERE kiosk_until IS NULL;