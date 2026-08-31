GRANT INSERT ON TABLE public.helpdesk_tickets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.helpdesk_tickets TO authenticated;
GRANT ALL ON TABLE public.helpdesk_tickets TO service_role;