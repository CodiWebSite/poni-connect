-- Create enum for document registry direction
CREATE TYPE public.document_direction AS ENUM ('incoming', 'outgoing');

-- Create enum for audience status
CREATE TYPE public.audience_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- Create enum for visitor status
CREATE TYPE public.visitor_status AS ENUM ('expected', 'checked_in', 'checked_out', 'cancelled');

-- Sequence for registration numbers
CREATE SEQUENCE public.document_registry_seq START WITH 1;

-- Document Registry table (Registratură)
CREATE TABLE public.document_registry (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_number TEXT NOT NULL UNIQUE,
    direction document_direction NOT NULL,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sender TEXT, -- for incoming
    recipient TEXT, -- for outgoing
    subject TEXT NOT NULL,
    category TEXT,
    file_url TEXT,
    notes TEXT,
    registered_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Function to generate registration number
CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('document_registry_seq')::TEXT, 5, '0');
END;
$$;

-- Trigger to auto-set registration number
CREATE OR REPLACE FUNCTION public.set_registration_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.registration_number IS NULL OR NEW.registration_number = '' THEN
    NEW.registration_number := generate_registration_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_document_registration_number
BEFORE INSERT ON public.document_registry
FOR EACH ROW
EXECUTE FUNCTION public.set_registration_number();

-- Audiences table (Programări audiențe)
CREATE TABLE public.audiences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    host_id UUID REFERENCES auth.users(id) NOT NULL, -- director, șef departament
    requester_name TEXT NOT NULL,
    requester_organization TEXT,
    requester_phone TEXT,
    requester_email TEXT,
    status audience_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Visitors table (Evidență vizitatori)
CREATE TABLE public.visitors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    organization TEXT,
    id_document_type TEXT, -- CI, Pașaport, etc.
    id_document_number TEXT,
    purpose TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_department TEXT,
    expected_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    badge_number TEXT,
    status visitor_status NOT NULL DEFAULT 'expected',
    notes TEXT,
    registered_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- Function to check secretariat access
CREATE OR REPLACE FUNCTION public.can_manage_secretariat(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin', 'secretariat', 'director')
  )
$$;

-- RLS Policies for document_registry
CREATE POLICY "Secretariat can view all documents"
ON public.document_registry FOR SELECT
USING (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can insert documents"
ON public.document_registry FOR INSERT
WITH CHECK (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can update documents"
ON public.document_registry FOR UPDATE
USING (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can delete documents"
ON public.document_registry FOR DELETE
USING (can_manage_secretariat(auth.uid()));

-- RLS Policies for audiences
CREATE POLICY "Secretariat can view all audiences"
ON public.audiences FOR SELECT
USING (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can insert audiences"
ON public.audiences FOR INSERT
WITH CHECK (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can update audiences"
ON public.audiences FOR UPDATE
USING (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can delete audiences"
ON public.audiences FOR DELETE
USING (can_manage_secretariat(auth.uid()));

-- Hosts can view their own audiences
CREATE POLICY "Hosts can view own audiences"
ON public.audiences FOR SELECT
USING (auth.uid() = host_id);

-- RLS Policies for visitors
CREATE POLICY "Secretariat can view all visitors"
ON public.visitors FOR SELECT
USING (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can insert visitors"
ON public.visitors FOR INSERT
WITH CHECK (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can update visitors"
ON public.visitors FOR UPDATE
USING (can_manage_secretariat(auth.uid()));

CREATE POLICY "Secretariat can delete visitors"
ON public.visitors FOR DELETE
USING (can_manage_secretariat(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_document_registry_updated_at
BEFORE UPDATE ON public.document_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audiences_updated_at
BEFORE UPDATE ON public.audiences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at
BEFORE UPDATE ON public.visitors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();