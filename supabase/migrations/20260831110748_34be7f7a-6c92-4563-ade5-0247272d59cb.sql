GRANT SELECT, INSERT, UPDATE, DELETE ON public.helpdesk_tickets TO authenticated;
GRANT INSERT ON public.helpdesk_tickets TO anon;
GRANT ALL ON public.helpdesk_tickets TO service_role;