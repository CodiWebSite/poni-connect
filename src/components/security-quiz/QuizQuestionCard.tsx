import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ShieldAlert, MessageSquareWarning, Phone, CreditCard, Smartphone, TrendingUp } from 'lucide-react';

type Question = {
  id: string;
  category: string;
  question_type: string;
  question_text: string;
  scenario_text?: string | null;
  options: string[];
  correct_answers: number[];
};

type Props = {
  question: Question;
  index: number;
  total: number;
  selected: number[];
  onSelect: (indices: number[]) => void;
  showResult?: boolean;
};

const categoryMeta: Record<string, { label: string; icon: any; color: string }> = {
  phishing: { label: 'Phishing', icon: MessageSquareWarning, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  phone_fraud: { label: 'Fraudă telefonică', icon: Phone, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  bank_data: { label: 'Date bancare', icon: CreditCard, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  remote_access: { label: 'Acces la distanță', icon: Smartphone, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  fake_investments: { label: 'Investiții false', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const QuizQuestionCard = ({ question, index, total, selected, onSelect, showResult }: Props) => {
  const meta = categoryMeta[question.category] || categoryMeta.phishing;
  const Icon = meta.icon;
  const isMultiple = question.question_type === 'multiple_choice';
  const isTrueFalse = question.question_type === 'true_false';

  const handleOptionClick = (optIndex: number) => {
    if (showResult) return;
    if (isMultiple) {
      onSelect(
        selected.includes(optIndex) ? selected.filter(i => i !== optIndex) : [...selected, optIndex]
      );
    } else {
      onSelect([optIndex]);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardContent className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className={cn('gap-1.5 text-xs font-medium px-2.5 py-1', meta.color)}>
            <Icon className="w-3.5 h-3.5" />
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            {index + 1} / {total}
          </span>
        </div>

        {/* Scenario */}
        {question.scenario_text && (
          <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
            <p className="text-sm leading-relaxed italic text-muted-foreground">
              <ShieldAlert className="w-4 h-4 inline mr-1.5 -mt-0.5 text-primary" />
              <span className="font-semibold not-italic text-foreground">Scenariu:</span>{' '}
              {question.scenario_text}
            </p>
          </div>
        )}

        {/* Question */}
        <p className="text-base font-semibold leading-relaxed">{question.question_text}</p>

        {isMultiple && !showResult && (
          <p className="text-xs text-muted-foreground">Selectează toate răspunsurile corecte.</p>
        )}

        {/* Options */}
        <div className="space-y-2.5">
          {question.options.map((opt, i) => {
            const isSelected = selected.includes(i);
            const isCorrect = question.correct_answers.includes(i);
            let optClasses = 'border-border/60 hover:border-primary/40 hover:bg-primary/5 cursor-pointer';

            if (showResult) {
              if (isCorrect) {
                optClasses = 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600';
              } else if (isSelected && !isCorrect) {
                optClasses = 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-600';
              } else {
                optClasses = 'border-border/30 opacity-60';
              }
            } else if (isSelected) {
              optClasses = 'border-primary bg-primary/10 ring-1 ring-primary/30';
            }

            return (
              <button
                key={i}
                onClick={() => handleOptionClick(i)}
                disabled={showResult}
                className={cn(
                  'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left text-sm',
                  optClasses
                )}
              >
                {isMultiple ? (
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                ) : (
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                      showResult && isCorrect && 'border-green-500 bg-green-500',
                      showResult && isSelected && !isCorrect && 'border-red-500 bg-red-500'
                    )}
                  >
                    {(isSelected || (showResult && isCorrect)) && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                )}
                <span className="flex-1">{opt}</span>
                {showResult && isCorrect && (
                  <span className="text-green-600 text-xs font-semibold">✓ Corect</span>
                )}
                {showResult && isSelected && !isCorrect && (
                  <span className="text-red-600 text-xs font-semibold">✗ Greșit</span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuizQuestionCard;
