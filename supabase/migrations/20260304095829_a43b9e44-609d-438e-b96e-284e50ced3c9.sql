-- Allow authenticated users to view their own helpdesk tickets by email
CREATE POLICY "Users can view own helpdesk tickets"
ON public.helpdesk_tickets
FOR SELECT
TO authenticated
USING (
  LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
);