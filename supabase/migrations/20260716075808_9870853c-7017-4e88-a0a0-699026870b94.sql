
-- Page permissions for pensionar_colaborator
INSERT INTO public.role_page_permissions (role_key, page_key, can_access) VALUES
  ('pensionar_colaborator', 'dashboard', true),
  ('pensionar_colaborator', 'my-profile', true),
  ('pensionar_colaborator', 'leave-request', true),
  ('pensionar_colaborator', 'chat', true),
  ('pensionar_colaborator', 'announcements', true),
  ('pensionar_colaborator', 'changelog', true),
  ('pensionar_colaborator', 'ghid', true),
  ('pensionar_colaborator', 'settings', true),
  ('pensionar_colaborator', 'install', true),
  ('pensionar_colaborator', 'activitati', true),
  ('pensionar_colaborator', 'carti-vizita', true),
  ('pensionar_colaborator', 'admin', false),
  ('pensionar_colaborator', 'hr-management', false),
  ('pensionar_colaborator', 'salarizare', false),
  ('pensionar_colaborator', 'medicina-muncii', false),
  ('pensionar_colaborator', 'arhiva', false),
  ('pensionar_colaborator', 'library', false),
  ('pensionar_colaborator', 'formulare', false),
  ('pensionar_colaborator', 'room-bookings', false),
  ('pensionar_colaborator', 'leave-calendar', false),
  ('pensionar_colaborator', 'my-team', false),
  ('pensionar_colaborator', 'system-status', false)
ON CONFLICT DO NOTHING;

-- Allow HR / sef_srus to insert/update/delete ONLY the pensionar_colaborator role
CREATE POLICY "HR can insert pensionar role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'pensionar_colaborator'::app_role
    AND (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'sef_srus'::app_role))
  );

CREATE POLICY "HR can update pensionar role"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    role = 'pensionar_colaborator'::app_role
    AND (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'sef_srus'::app_role))
  )
  WITH CHECK (
    role = 'pensionar_colaborator'::app_role
    AND (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'sef_srus'::app_role))
  );

CREATE POLICY "HR can delete pensionar role"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    role = 'pensionar_colaborator'::app_role
    AND (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'sef_srus'::app_role))
  );
