ALTER TABLE public.payslip_batches
  ADD COLUMN IF NOT EXISTS processed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz,
  ADD COLUMN IF NOT EXISTS error text;