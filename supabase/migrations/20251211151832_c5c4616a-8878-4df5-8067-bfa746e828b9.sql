-- Create enum for procurement request status
CREATE TYPE public.procurement_status AS ENUM (
  'draft',
  'pending_department_head',
  'pending_procurement',
  'pending_director',
  'pending_cfp',
  'approved',
  'rejected'
);

-- Create enum for procurement category
CREATE TYPE public.procurement_category AS ENUM (
  'consumabile_laborator',
  'echipamente_it',
  'birotica',
  'echipamente_cercetare',
  'servicii',
  'mobilier',
  'altele'
);

-- Create enum for urgency level
CREATE TYPE public.procurement_urgency AS ENUM (
  'normal',
  'urgent',
  'foarte_urgent'
);

-- Create procurement requests table (Referate de necesitate)
CREATE TABLE public.procurement_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number TEXT NOT NULL,
  user_id UUID NOT NULL,
  department TEXT NOT NULL,
  
  -- Request details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  justification TEXT NOT NULL,
  category procurement_category NOT NULL DEFAULT 'altele',
  urgency procurement_urgency NOT NULL DEFAULT 'normal',
  
  -- Financial details
  estimated_value DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RON',
  budget_source TEXT,
  
  -- Items (stored as JSON array)
  items JSONB NOT NULL DEFAULT '[]',
  
  -- Status and workflow
  status procurement_status NOT NULL DEFAULT 'draft',
  
  -- Approvals
  department_head_id UUID,
  department_head_approved_at TIMESTAMP WITH TIME ZONE,
  department_head_notes TEXT,
  
  procurement_officer_id UUID,
  procurement_approved_at TIMESTAMP WITH TIME ZONE,
  procurement_notes TEXT,
  
  director_id UUID,
  director_approved_at TIMESTAMP WITH TIME ZONE,
  director_notes TEXT,
  
  cfp_officer_id UUID,
  cfp_approved_at TIMESTAMP WITH TIME ZONE,
  cfp_notes TEXT,
  
  rejection_reason TEXT,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.procurement_requests ENABLE ROW LEVEL SECURITY;

-- Create sequence for request numbers
CREATE SEQUENCE IF NOT EXISTS procurement_request_seq START 1;

-- Function to generate request number
CREATE OR REPLACE FUNCTION generate_procurement_request_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'RN-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('procurement_request_seq')::TEXT, 4, '0');
END;
$$;

-- Trigger to auto-generate request number
CREATE OR REPLACE FUNCTION set_procurement_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_procurement_request_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_procurement_request_number
  BEFORE INSERT ON public.procurement_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_procurement_request_number();

-- Update timestamp trigger
CREATE TRIGGER update_procurement_requests_updated_at
  BEFORE UPDATE ON public.procurement_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Users can view their own requests
CREATE POLICY "Users can view their own procurement requests"
  ON public.procurement_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Department heads can view requests from their department
CREATE POLICY "Department heads can view department requests"
  ON public.procurement_requests
  FOR SELECT
  USING (
    has_role(auth.uid(), 'department_head') OR
    has_role(auth.uid(), 'director') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'super_admin')
  );

-- Users can create their own requests
CREATE POLICY "Users can create procurement requests"
  ON public.procurement_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own draft requests
CREATE POLICY "Users can update own draft requests"
  ON public.procurement_requests
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');

-- Approvers can update requests they need to approve
CREATE POLICY "Approvers can update requests"
  ON public.procurement_requests
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'department_head') OR
    has_role(auth.uid(), 'director') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'super_admin')
  );

-- Users can delete their own draft requests
CREATE POLICY "Users can delete own draft requests"
  ON public.procurement_requests
  FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');