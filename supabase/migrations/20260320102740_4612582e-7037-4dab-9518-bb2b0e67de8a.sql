
-- ============================================================
-- 1. Approval Workflows — configurable multi-step approval chains
-- ============================================================
CREATE TABLE public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  request_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.approval_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  approver_role text NOT NULL,
  step_label text NOT NULL,
  is_optional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read workflows" ON public.approval_workflows
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage workflows" ON public.approval_workflows
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated can read workflow steps" ON public.approval_workflow_steps
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage workflow steps" ON public.approval_workflow_steps
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed current leave approval workflow
INSERT INTO public.approval_workflows (name, description, request_type, is_active)
VALUES 
  ('Aprobare Concediu Odihnă', 'Fluxul standard de aprobare pentru cererile de concediu de odihnă', 'concediu', true),
  ('Aprobare Cerere HR', 'Flux generic pentru cererile HR (adeverințe, etc.)', 'hr_request', true);

-- Seed steps for leave workflow
INSERT INTO public.approval_workflow_steps (workflow_id, step_order, approver_role, step_label)
SELECT w.id, s.step_order, s.approver_role, s.step_label
FROM public.approval_workflows w,
  (VALUES (1, 'sef', 'Aprobare Șef Departament'), (2, 'sef_srus', 'Validare SRUS'), (3, 'director_institut', 'Aprobare Director')) AS s(step_order, approver_role, step_label)
WHERE w.request_type = 'concediu';

-- Seed steps for HR request workflow
INSERT INTO public.approval_workflow_steps (workflow_id, step_order, approver_role, step_label)
SELECT w.id, s.step_order, s.approver_role, s.step_label
FROM public.approval_workflows w,
  (VALUES (1, 'hr', 'Procesare HR'), (2, 'sef_srus', 'Validare Șef SRUS')) AS s(step_order, approver_role, step_label)
WHERE w.request_type = 'hr_request';

-- ============================================================
-- 2. Request Routing — which request type goes to which department/role
-- ============================================================
CREATE TABLE public.request_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  request_label text NOT NULL,
  target_role text NOT NULL,
  target_department text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.request_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read routing rules" ON public.request_routing_rules
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage routing rules" ON public.request_routing_rules
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed current routing rules
INSERT INTO public.request_routing_rules (request_type, request_label, target_role, description)
VALUES
  ('concediu', 'Cerere Concediu Odihnă', 'sef', 'Cererile de concediu se trimit inițial la Șeful de Departament'),
  ('adeverinta', 'Adeverință', 'hr', 'Adeverințele sunt procesate de SRUS'),
  ('corectie_date', 'Corecție Date Personale', 'hr', 'Corecțiile de date se trimit la HR'),
  ('helpdesk', 'Tichet HelpDesk', 'super_admin', 'Tichetele IT se trimit la administratori'),
  ('cerere_cont', 'Cerere Creare Cont', 'super_admin', 'Cererile de cont se trimit la administratori'),
  ('echipament', 'Cerere Echipament', 'super_admin', 'Cererile de echipament se trimit la admin');

-- ============================================================
-- 3. Notification Rules — what notification, to whom, when
-- ============================================================
CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event text NOT NULL,
  trigger_label text NOT NULL,
  recipient_role text,
  recipient_type text NOT NULL DEFAULT 'role',
  channel text NOT NULL DEFAULT 'in_app',
  message_template text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read notification rules" ON public.notification_rules
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage notification rules" ON public.notification_rules
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed current notification rules
INSERT INTO public.notification_rules (name, trigger_event, trigger_label, recipient_role, recipient_type, channel, message_template)
VALUES
  ('Cerere concediu nouă', 'leave_request_created', 'Cerere concediu creată', 'sef', 'role', 'email', 'Un angajat din departamentul tău a depus o cerere de concediu.'),
  ('Concediu aprobat de șef', 'leave_approved_dept_head', 'Concediu aprobat de Șef Dept.', 'sef_srus', 'role', 'email', 'O cerere de concediu necesită validarea SRUS.'),
  ('Concediu aprobat final', 'leave_approved_final', 'Concediu aprobat final', NULL, 'requester', 'in_app', 'Cererea ta de concediu a fost aprobată.'),
  ('Concediu respins', 'leave_rejected', 'Concediu respins', NULL, 'requester', 'in_app', 'Cererea ta de concediu a fost respinsă.'),
  ('Tichet HelpDesk nou', 'helpdesk_created', 'Tichet HelpDesk creat', 'super_admin', 'role', 'in_app', 'Un nou tichet HelpDesk a fost deschis.'),
  ('Cerere cont nouă', 'account_request_created', 'Cerere cont creată', 'super_admin', 'role', 'in_app', 'O nouă cerere de creare cont a fost trimisă.'),
  ('Expiare fișă medicală', 'medical_expiry', 'Fișă medicală expiră', 'medic_medicina_muncii', 'role', 'in_app', 'O fișă de aptitudine urmează să expire.'),
  ('Reminder aprobare concediu', 'leave_approval_reminder', 'Reminder aprobator concediu', NULL, 'approver', 'email', 'Ai cereri de concediu care așteaptă aprobarea ta.');
