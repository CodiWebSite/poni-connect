
-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sef';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sef_srus';
