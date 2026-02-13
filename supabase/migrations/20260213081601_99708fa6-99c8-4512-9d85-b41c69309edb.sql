
-- Create borrow history table
CREATE TABLE public.library_borrow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL, -- 'book' or 'magazine'
  item_id uuid NOT NULL,
  action text NOT NULL, -- 'borrow' or 'return'
  employee_id uuid NULL,
  employee_name text NULL,
  performed_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.library_borrow_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Library managers can select history" ON public.library_borrow_history FOR SELECT TO authenticated USING (can_manage_library(auth.uid()));
CREATE POLICY "Library managers can insert history" ON public.library_borrow_history FOR INSERT TO authenticated WITH CHECK (can_manage_library(auth.uid()));
