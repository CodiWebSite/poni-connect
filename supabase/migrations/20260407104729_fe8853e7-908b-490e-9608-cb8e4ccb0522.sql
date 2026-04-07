
-- Table: security_quiz_questions
CREATE TABLE public.security_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'phishing',
  question_type TEXT NOT NULL DEFAULT 'single_choice',
  question_text TEXT NOT NULL,
  scenario_text TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.security_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active questions"
  ON public.security_quiz_questions FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admin full access quiz questions"
  ON public.security_quiz_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Table: security_quiz_attempts
CREATE TABLE public.security_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.security_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own attempts"
  ON public.security_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own attempts"
  ON public.security_quiz_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "HR and super_admin can view all attempts"
  ON public.security_quiz_attempts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Super admin full access quiz attempts"
  ON public.security_quiz_attempts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at on questions
CREATE TRIGGER update_security_quiz_questions_updated_at
  BEFORE UPDATE ON public.security_quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
