
-- Create custom holidays table
CREATE TABLE public.custom_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on date to prevent duplicates
ALTER TABLE public.custom_holidays ADD CONSTRAINT unique_holiday_date UNIQUE (holiday_date);

-- Enable RLS
ALTER TABLE public.custom_holidays ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view holidays
CREATE POLICY "Authenticated users can view holidays"
  ON public.custom_holidays FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/super_admin/hr can manage holidays
CREATE POLICY "Admins and HR can insert holidays"
  ON public.custom_holidays FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.has_role(auth.uid(), 'hr'::app_role)
  );

CREATE POLICY "Admins and HR can delete holidays"
  ON public.custom_holidays FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.has_role(auth.uid(), 'hr'::app_role)
  );
