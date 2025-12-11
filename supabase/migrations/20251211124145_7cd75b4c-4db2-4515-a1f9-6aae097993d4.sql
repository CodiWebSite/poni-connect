-- Add new enum values
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'department_head';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'secretariat';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'director';