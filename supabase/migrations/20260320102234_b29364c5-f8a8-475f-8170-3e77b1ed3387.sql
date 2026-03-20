
-- Table for storing role-page access permissions (configurable from Admin UI)
CREATE TABLE public.role_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  page_key text NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_key, page_key)
);

ALTER TABLE public.role_page_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for Sidebar access checks)
CREATE POLICY "Authenticated can read permissions"
ON public.role_page_permissions
FOR SELECT TO authenticated
USING (true);

-- Only super_admin can manage
CREATE POLICY "Super admin can manage permissions"
ON public.role_page_permissions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed all role-page combinations with current access rules
INSERT INTO public.role_page_permissions (role_key, page_key, can_access)
SELECT r.role_key, p.page_key,
  CASE
    -- Pages accessible to ALL roles
    WHEN p.page_key IN ('dashboard','announcements','my-profile','leave-calendar','formulare','leave-request','room-bookings','activitati','chat','arhiva','ghid','install','settings','carti-vizita') THEN true
    -- super_admin has access to everything
    WHEN r.role_key = 'super_admin' THEN true
    -- my-team: department heads
    WHEN p.page_key = 'my-team' AND r.role_key IN ('sef','sef_srus','director_institut','director_adjunct') THEN true
    -- library
    WHEN p.page_key = 'library' AND r.role_key = 'bibliotecar' THEN true
    -- medicina-muncii
    WHEN p.page_key = 'medicina-muncii' AND r.role_key IN ('hr','sef_srus','medic_medicina_muncii') THEN true
    -- hr-management
    WHEN p.page_key = 'hr-management' AND r.role_key IN ('hr','sef_srus') THEN true
    -- salarizare
    WHEN p.page_key = 'salarizare' AND r.role_key = 'salarizare' THEN true
    ELSE false
  END as can_access
FROM 
  (VALUES ('super_admin'),('admin'),('hr'),('sef_srus'),('sef'),('director_institut'),('director_adjunct'),('secretar_stiintific'),('bibliotecar'),('salarizare'),('achizitii'),('contabilitate'),('oficiu_juridic'),('compartiment_comunicare'),('secretariat'),('medic_medicina_muncii'),('user')) AS r(role_key),
  (VALUES ('dashboard'),('announcements'),('my-profile'),('leave-calendar'),('formulare'),('leave-request'),('my-team'),('library'),('room-bookings'),('activitati'),('chat'),('medicina-muncii'),('arhiva'),('ghid'),('install'),('hr-management'),('salarizare'),('settings'),('system-status'),('carti-vizita'),('admin'),('changelog')) AS p(page_key);
