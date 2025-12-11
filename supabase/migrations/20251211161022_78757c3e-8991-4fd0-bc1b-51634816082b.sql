-- Create department_heads table to map departments to their heads
CREATE TABLE public.department_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL UNIQUE,
  head_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.department_heads ENABLE ROW LEVEL SECURITY;

-- Everyone can view department heads (needed for routing)
CREATE POLICY "Everyone can view department heads"
ON public.department_heads
FOR SELECT
USING (true);

-- Only super_admin and admin can manage department heads
CREATE POLICY "Admins can insert department heads"
ON public.department_heads
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update department heads"
ON public.department_heads
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete department heads"
ON public.department_heads
FOR DELETE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_department_heads_updated_at
BEFORE UPDATE ON public.department_heads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();