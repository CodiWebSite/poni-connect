
CREATE TABLE public.payslip_issue_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payslip_issue_reports TO authenticated;
GRANT ALL ON public.payslip_issue_reports TO service_role;

ALTER TABLE public.payslip_issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users report their own payslip issues"
  ON public.payslip_issue_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users see own reports"
  ON public.payslip_issue_reports FOR SELECT TO authenticated
  USING (
    auth.uid() = reported_by
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'salarizare'::app_role)
  );

CREATE POLICY "Salarizare manages reports"
  ON public.payslip_issue_reports FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'salarizare'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'salarizare'::app_role));

CREATE TRIGGER update_payslip_issue_reports_updated_at
  BEFORE UPDATE ON public.payslip_issue_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payslip_issue_reports_payslip ON public.payslip_issue_reports(payslip_id);
CREATE INDEX idx_payslip_issue_reports_status ON public.payslip_issue_reports(status);

-- Notify salarizare admins on new report
CREATE OR REPLACE FUNCTION public.notify_payslip_issue_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role IN ('super_admin', 'salarizare') LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_type, related_id)
    VALUES (
      r.user_id,
      'Fluturaș semnalat ca incorect',
      'Un angajat a raportat o problemă la un fluturaș: ' || LEFT(NEW.reason, 120),
      'warning',
      'payslip_issue_report',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_payslip_issue_report
  AFTER INSERT ON public.payslip_issue_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_payslip_issue_report();
