
-- Drop all existing policies on helpdesk_tickets
DROP POLICY IF EXISTS "Admins can delete helpdesk tickets" ON public.helpdesk_tickets;
DROP POLICY IF EXISTS "Admins can update helpdesk tickets" ON public.helpdesk_tickets;
DROP POLICY IF EXISTS "Admins can view helpdesk tickets" ON public.helpdesk_tickets;
DROP POLICY IF EXISTS "Anyone can submit helpdesk tickets" ON public.helpdesk_tickets;
DROP POLICY IF EXISTS "Users can view own helpdesk tickets" ON public.helpdesk_tickets;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can view helpdesk tickets"
ON public.helpdesk_tickets FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own helpdesk tickets"
ON public.helpdesk_tickets FOR SELECT TO authenticated
USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text));

CREATE POLICY "Anyone can submit helpdesk tickets"
ON public.helpdesk_tickets FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update helpdesk tickets"
ON public.helpdesk_tickets FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete helpdesk tickets"
ON public.helpdesk_tickets FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
