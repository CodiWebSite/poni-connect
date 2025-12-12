-- Create knowledge base table
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  author_id UUID,
  is_published BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Everyone can view published articles
CREATE POLICY "Everyone can view published articles"
ON public.knowledge_base
FOR SELECT
USING (is_published = true);

-- Admins and HR can view all articles (including drafts)
CREATE POLICY "Admins and HR can view all articles"
ON public.knowledge_base
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr')
);

-- Admins and HR can insert articles
CREATE POLICY "Admins and HR can insert articles"
ON public.knowledge_base
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr')
);

-- Admins and HR can update articles
CREATE POLICY "Admins and HR can update articles"
ON public.knowledge_base
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr')
);

-- Admins and HR can delete articles
CREATE POLICY "Admins and HR can delete articles"
ON public.knowledge_base
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr')
);

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();