
CREATE TABLE public.helpdesk_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT 'General',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.helpdesk_tickets ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (even unauthenticated via anon key)
CREATE POLICY "Anyone can submit helpdesk tickets"
  ON public.helpdesk_tickets FOR INSERT
  WITH CHECK (true);

-- Admins can view all tickets
CREATE POLICY "Admins can view helpdesk tickets"
  ON public.helpdesk_tickets FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Admins can update tickets
CREATE POLICY "Admins can update helpdesk tickets"
  ON public.helpdesk_tickets FOR UPDATE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Admins can delete tickets
CREATE POLICY "Admins can delete helpdesk tickets"
  ON public.helpdesk_tickets FOR DELETE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_helpdesk_tickets_updated_at
  BEFORE UPDATE ON public.helpdesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
