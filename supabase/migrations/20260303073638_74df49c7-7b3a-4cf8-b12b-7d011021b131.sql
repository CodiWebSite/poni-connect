
-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'achizitii';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contabilitate';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'oficiu_juridic';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compartiment_comunicare';
