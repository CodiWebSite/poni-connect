DROP POLICY IF EXISTS "Users can view own helpdesk tickets" ON public.helpdesk_tickets;
CREATE POLICY "Users can view own helpdesk tickets"
ON public.helpdesk_tickets
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
);