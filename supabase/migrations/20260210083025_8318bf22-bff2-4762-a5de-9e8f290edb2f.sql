
-- Table for leave carry-over from previous years (e.g. 2025 → 2026)
CREATE TABLE public.leave_carryover (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_personal_data_id UUID NOT NULL,
  from_year INTEGER NOT NULL,
  to_year INTEGER NOT NULL,
  initial_days INTEGER NOT NULL DEFAULT 0,
  used_days INTEGER NOT NULL DEFAULT 0,
  remaining_days INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_personal_data_id, from_year, to_year)
);

ALTER TABLE public.leave_carryover ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can view all carryover" ON public.leave_carryover FOR SELECT USING (can_manage_hr(auth.uid()));
CREATE POLICY "HR can insert carryover" ON public.leave_carryover FOR INSERT WITH CHECK (can_manage_hr(auth.uid()));
CREATE POLICY "HR can update carryover" ON public.leave_carryover FOR UPDATE USING (can_manage_hr(auth.uid()));
CREATE POLICY "HR can delete carryover" ON public.leave_carryover FOR DELETE USING (can_manage_hr(auth.uid()));

-- Users can see their own carryover via their EPD
CREATE POLICY "Users can view own carryover" ON public.leave_carryover FOR SELECT
  USING (employee_personal_data_id IN (
    SELECT epd.id FROM employee_personal_data epd
    JOIN employee_records er ON er.id = epd.employee_record_id
    WHERE er.user_id = auth.uid()
  ));

-- Table for bonus/extra leave allocations (handicap, legal basis, etc.)
CREATE TABLE public.leave_bonus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_personal_data_id UUID NOT NULL,
  year INTEGER NOT NULL,
  bonus_days INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  legal_basis TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_bonus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can view all bonus" ON public.leave_bonus FOR SELECT USING (can_manage_hr(auth.uid()));
CREATE POLICY "HR can insert bonus" ON public.leave_bonus FOR INSERT WITH CHECK (can_manage_hr(auth.uid()));
CREATE POLICY "HR can update bonus" ON public.leave_bonus FOR UPDATE USING (can_manage_hr(auth.uid()));
CREATE POLICY "HR can delete bonus" ON public.leave_bonus FOR DELETE USING (can_manage_hr(auth.uid()));

CREATE POLICY "Users can view own bonus" ON public.leave_bonus FOR SELECT
  USING (employee_personal_data_id IN (
    SELECT epd.id FROM employee_personal_data epd
    JOIN employee_records er ON er.id = epd.employee_record_id
    WHERE er.user_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_leave_carryover_updated_at BEFORE UPDATE ON public.leave_carryover
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leave_bonus_updated_at BEFORE UPDATE ON public.leave_bonus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
