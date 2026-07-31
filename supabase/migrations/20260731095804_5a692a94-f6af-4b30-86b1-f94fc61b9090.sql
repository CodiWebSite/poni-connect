ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS car_attached boolean NOT NULL DEFAULT false;
ALTER TABLE public.payslip_batches ADD COLUMN IF NOT EXISTS car_filename text;
ALTER TABLE public.payslip_batches ADD COLUMN IF NOT EXISTS car_attached_count integer NOT NULL DEFAULT 0;