-- Add pending_srus to leave_request_status enum
ALTER TYPE public.leave_request_status ADD VALUE IF NOT EXISTS 'pending_srus' AFTER 'pending_department_head';

-- Add SRUS signature fields to leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS srus_officer_name text,
  ADD COLUMN IF NOT EXISTS srus_signature text,
  ADD COLUMN IF NOT EXISTS srus_signed_at timestamptz;