
-- Create library_books table
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cota text NOT NULL,
  inventar text NOT NULL,
  titlu text NOT NULL,
  autor text NOT NULL,
  location_status text NOT NULL DEFAULT 'depozit',
  borrowed_by uuid NULL,
  borrowed_at timestamp with time zone NULL,
  returned_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create library_magazines table
CREATE TABLE public.library_magazines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titlu text NOT NULL,
  an integer NOT NULL,
  volum text NULL,
  numar text NULL,
  location_status text NOT NULL DEFAULT 'depozit',
  borrowed_by uuid NULL,
  borrowed_at timestamp with time zone NULL,
  returned_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_magazines ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.can_manage_library(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('bibliotecar', 'super_admin')
  )
$$;

-- RLS policies for library_books
CREATE POLICY "Library managers can select books" ON public.library_books FOR SELECT TO authenticated USING (can_manage_library(auth.uid()));
CREATE POLICY "Library managers can insert books" ON public.library_books FOR INSERT TO authenticated WITH CHECK (can_manage_library(auth.uid()));
CREATE POLICY "Library managers can update books" ON public.library_books FOR UPDATE TO authenticated USING (can_manage_library(auth.uid()));
CREATE POLICY "Library managers can delete books" ON public.library_books FOR DELETE TO authenticated USING (can_manage_library(auth.uid()));

-- RLS policies for library_magazines
CREATE POLICY "Library managers can select magazines" ON public.library_magazines FOR SELECT TO authenticated USING (can_manage_library(auth.uid()));
CREATE POLICY "Library managers can insert magazines" ON public.library_magazines FOR INSERT TO authenticated WITH CHECK (can_manage_library(auth.uid()));
CREATE POLICY "Library managers can update magazines" ON public.library_magazines FOR UPDATE TO authenticated USING (can_manage_library(auth.uid()));
CREATE POLICY "Library managers can delete magazines" ON public.library_magazines FOR DELETE TO authenticated USING (can_manage_library(auth.uid()));

-- Timestamp trigger for library_books
CREATE TRIGGER update_library_books_updated_at
BEFORE UPDATE ON public.library_books
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Timestamp trigger for library_magazines
CREATE TRIGGER update_library_magazines_updated_at
BEFORE UPDATE ON public.library_magazines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
