
-- Soft delete support for employees
ALTER TABLE public.employee_personal_data ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.employee_personal_data ADD COLUMN archived_at timestamptz;
ALTER TABLE public.employee_personal_data ADD COLUMN archived_by uuid;
ALTER TABLE public.employee_personal_data ADD COLUMN archive_reason text;

-- Index for filtering active employees
CREATE INDEX idx_epd_is_archived ON public.employee_personal_data (is_archived);
