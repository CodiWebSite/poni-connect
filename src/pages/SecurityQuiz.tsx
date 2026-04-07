import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import SecurityQuizLanding from '@/components/security-quiz/SecurityQuizLanding';
import SecurityQuizEngine from '@/components/security-quiz/SecurityQuizEngine';
import SecurityQuizResults from '@/components/security-quiz/SecurityQuizResults';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Question = {
  id: string;
  category: string;
  question_type: string;
  question_text: string;
  scenario_text?: string | null;
  options: string[];
  correct_answers: number[];
  explanation?: string | null;
};

type Phase = 'landing' | 'quiz' | 'results';

const SecurityQuiz = () => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('landing');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [score, setScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('moderate');
  const [loading, setLoading] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('security_quiz_questions')
      .select('id, category, question_type, question_text, scenario_text, options, correct_answers, explanation')
      .eq('is_active', true)
      .order('order_index');

    if (error) {
      toast.error('Eroare la încărcarea întrebărilor');
      setLoading(false);
      return;
    }

    setQuestions((data as Question[]) || []);
    setLoading(false);
  };

  const handleStart = async () => {
    await fetchQuestions();
    setAnswers({});
    setPhase('quiz');
  };

  const handleComplete = async (userAnswers: Record<string, number[]>) => {
    setAnswers(userAnswers);

    let correct = 0;
    const answerDetails: any[] = [];

    questions.forEach(q => {
      const sel = userAnswers[q.id] || [];
      const isCorrect = JSON.stringify([...sel].sort()) === JSON.stringify([...q.correct_answers].sort());
      if (isCorrect) correct++;
      answerDetails.push({ question_id: q.id, selected: sel, correct: isCorrect });
    });

    setScore(correct);
    const pct = Math.round((correct / questions.length) * 100);
    const level = pct >= 90 ? 'excellent' : pct >= 70 ? 'good' : pct >= 50 ? 'moderate' : 'high';
    setRiskLevel(level);

    // Save attempt
    if (user) {
      await supabase.from('security_quiz_attempts').insert({
        user_id: user.id,
        score: correct,
        total_questions: questions.length,
        answers: answerDetails,
        risk_level: level,
      });
    }

    setPhase('results');
  };

  const handleRetry = () => {
    setAnswers({});
    setPhase('quiz');
  };

  return (
    <MainLayout title="Test de Siguranță Digitală" description="Evaluează-ți cunoștințele de securitate online">
      {phase === 'landing' && <SecurityQuizLanding onStart={handleStart} />}
      {phase === 'quiz' && !loading && questions.length > 0 && (
        <SecurityQuizEngine questions={questions} onComplete={handleComplete} />
      )}
      {phase === 'quiz' && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {phase === 'results' && (
        <SecurityQuizResults
          questions={questions}
          answers={answers}
          score={score}
          total={questions.length}
          riskLevel={riskLevel}
          onRetry={handleRetry}
          onBack={() => setPhase('landing')}
        />
      )}
    </MainLayout>
  );
};

export default SecurityQuiz;
