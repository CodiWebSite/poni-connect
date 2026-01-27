-- Create employee_personal_data table for storing sensitive employee information
-- This includes CNP, CI details, and address information from the ICMPP HR system

CREATE TABLE public.employee_personal_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_record_id uuid UNIQUE, -- Links to internal employee_records when they have auth accounts
  email text UNIQUE NOT NULL, -- Used to match employees when they create accounts
  first_name text NOT NULL,
  last_name text NOT NULL,
  cnp text UNIQUE NOT NULL, -- Personal Numeric Code (CNP)
  ci_series text, -- Identity Card series
  ci_number text, -- Identity Card number
  ci_issued_by text, -- Identity Card issuing authority
  ci_issued_date date, -- Identity Card issue date
  address_street text,
  address_number text,
  address_block text,
  address_floor text,
  address_apartment text,
  address_city text,
  address_county text,
  employment_date date NOT NULL,
  original_id uuid, -- Original ID from the import file for reference
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.employee_personal_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only HR personnel can access this sensitive data
CREATE POLICY "HR can view all employee personal data"
ON public.employee_personal_data
FOR SELECT
TO authenticated
USING (can_manage_hr(auth.uid()));

CREATE POLICY "HR can insert employee personal data"
ON public.employee_personal_data
FOR INSERT
TO authenticated
WITH CHECK (can_manage_hr(auth.uid()));

CREATE POLICY "HR can update employee personal data"
ON public.employee_personal_data
FOR UPDATE
TO authenticated
USING (can_manage_hr(auth.uid()));

CREATE POLICY "HR can delete employee personal data"
ON public.employee_personal_data
FOR DELETE
TO authenticated
USING (can_manage_hr(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_employee_personal_data_updated_at
BEFORE UPDATE ON public.employee_personal_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_employee_personal_data_email ON public.employee_personal_data(email);
CREATE INDEX idx_employee_personal_data_cnp ON public.employee_personal_data(cnp);