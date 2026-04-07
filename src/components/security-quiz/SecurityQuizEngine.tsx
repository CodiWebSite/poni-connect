import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import QuizQuestionCard from './QuizQuestionCard';

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

type Props = {
  questions: Question[];
  onComplete: (answers: Record<string, number[]>) => void;
};

const SecurityQuizEngine = ({ questions, onComplete }: Props) => {
  const shuffled = useMemo(() => [...questions].sort(() => Math.random() - 0.5), [questions]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});

  const current = shuffled[currentIdx];
  const progress = ((currentIdx + 1) / shuffled.length) * 100;
  const isLast = currentIdx === shuffled.length - 1;
  const currentAnswer = answers[current?.id] || [];
  const answeredCount = Object.keys(answers).length;

  const handleSelect = (indices: number[]) => {
    setAnswers(prev => ({ ...prev, [current.id]: indices }));
  };

  const canFinish = answeredCount === shuffled.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Întrebarea {currentIdx + 1} din {shuffled.length}</span>
          <span>{answeredCount} răspunse</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question Card */}
      <QuizQuestionCard
        question={current}
        index={currentIdx}
        total={shuffled.length}
        selected={currentAnswer}
        onSelect={handleSelect}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx(i => i - 1)}
          disabled={currentIdx === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Înapoi
        </Button>

        {isLast ? (
          <Button
            onClick={() => onComplete(answers)}
            disabled={!canFinish}
            className="gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Finalizează testul
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIdx(i => i + 1)}
            disabled={currentAnswer.length === 0}
            className="gap-1.5"
          >
            Următoarea <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default SecurityQuizEngine;
