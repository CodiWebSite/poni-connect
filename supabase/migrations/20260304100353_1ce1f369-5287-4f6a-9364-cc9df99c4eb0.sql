-- Drop and recreate INSERT policy with explicit anon access
DROP POLICY IF EXISTS "Anyone can submit helpdesk tickets" ON public.helpdesk_tickets;
CREATE POLICY "Anyone can submit helpdesk tickets"
ON public.helpdesk_tickets
FOR INSERT
TO anon, authenticated
WITH CHECK (true);