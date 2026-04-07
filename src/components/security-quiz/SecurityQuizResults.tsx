import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
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
  answers: Record<string, number[]>;
  score: number;
  total: number;
  riskLevel: string;
  onRetry: () => void;
  onBack: () => void;
};

const riskMeta: Record<string, { label: string; color: string; icon: any; message: string }> = {
  excellent: {
    label: 'Foarte bine',
    color: 'text-green-600 dark:text-green-400',
    icon: ShieldCheck,
    message: 'Excelent! Ești foarte bine pregătit/ă pentru a face față amenințărilor digitale.',
  },
  good: {
    label: 'Bine, dar cu atenție',
    color: 'text-blue-600 dark:text-blue-400',
    icon: CheckCircle2,
    message: 'Ai cunoștințe bune, dar mai sunt câteva aspecte pe care le poți îmbunătăți.',
  },
  moderate: {
    label: 'Risc moderat',
    color: 'text-orange-600 dark:text-orange-400',
    icon: AlertTriangle,
    message: 'Ai nevoie de mai multă atenție la detalii. Recitește sfaturile de mai jos.',
  },
  high: {
    label: 'Risc ridicat',
    color: 'text-red-600 dark:text-red-400',
    icon: ShieldX,
    message: 'Este important să acorzi mai multă atenție securității digitale. Revizuiește regulile de bază.',
  },
};

const essentialRules = [
  'Nu da niciodată parole, coduri PIN sau coduri de autorizare nimănui, nici măcar „băncii".',
  'Verifică întotdeauna adresa expeditorului și URL-ul din link-uri înainte de a da click.',
  'Nu instala aplicații de control la distanță la cererea unor persoane necunoscute.',
  'Dacă ceva pare prea bun ca să fie adevărat (profit garantat, risc zero), este aproape sigur o înșelăciune.',
  'Sună direct banca sau instituția la numărul oficial dacă primești un apel sau mesaj suspect.',
];

const SecurityQuizResults = ({ questions, answers, score, total, riskLevel, onRetry, onBack }: Props) => {
  const pct = Math.round((score / total) * 100);
  const meta = riskMeta[riskLevel] || riskMeta.moderate;
  const RiskIcon = meta.icon;

  const wrongCategories = questions
    .filter(q => {
      const sel = answers[q.id] || [];
      return JSON.stringify(sel.sort()) !== JSON.stringify([...q.correct_answers].sort());
    })
    .map(q => q.category);
  const uniqueWrongCats = [...new Set(wrongCategories)];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Score Card */}
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden">
        <div className={cn(
          'h-2',
          pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-blue-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500'
        )} />
        <CardContent className="p-6 text-center space-y-4">
          <RiskIcon className={cn('w-16 h-16 mx-auto', meta.color)} />
          <div>
            <h2 className="text-2xl font-bold">{meta.label}</h2>
            <p className="text-muted-foreground mt-1">{meta.message}</p>
          </div>
          <div className="space-y-2">
            <p className="text-4xl font-bold">{pct}%</p>
            <p className="text-sm text-muted-foreground">{score} din {total} răspunsuri corecte</p>
            <Progress value={pct} className="h-3 max-w-xs mx-auto" />
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {uniqueWrongCats.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" /> Recomandări pentru tine
            </h3>
            <p className="text-sm text-muted-foreground">
              Ai greșit la categoriile: {uniqueWrongCats.map(c => {
                const labels: Record<string, string> = {
                  phishing: 'Phishing', phone_fraud: 'Fraudă telefonică',
                  bank_data: 'Date bancare', remote_access: 'Acces la distanță',
                  fake_investments: 'Investiții false',
                };
                return labels[c] || c;
              }).join(', ')}. Recitește sfaturile asociate acestor teme.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Essential Rules */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" /> 5 Reguli esențiale de siguranță digitală
          </h3>
          <ol className="space-y-2">
            {essentialRules.map((rule, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Review answers */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Recapitulare răspunsuri</h3>
        {questions.map((q, i) => {
          const sel = answers[q.id] || [];
          const isCorrect = JSON.stringify(sel.sort()) === JSON.stringify([...q.correct_answers].sort());
          return (
            <div key={q.id} className="space-y-2">
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">Întrebarea {i + 1}</span>
              </div>
              <QuizQuestionCard
                question={q}
                index={i}
                total={questions.length}
                selected={sel}
                onSelect={() => {}}
                showResult
              />
              {q.explanation && (
                <div className="bg-muted/50 rounded-xl p-3 border text-sm">
                  <span className="font-semibold">Explicație:</span> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 pb-8">
        <Button variant="outline" onClick={onBack}>Înapoi la pagina testului</Button>
        <Button onClick={onRetry} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Refă testul
        </Button>
      </div>
    </div>
  );
};

export default SecurityQuizResults;
