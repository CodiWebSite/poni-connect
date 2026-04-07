import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Play, Clock, Award, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

type Attempt = {
  id: string;
  score: number;
  total_questions: number;
  risk_level: string;
  completed_at: string;
};

type Props = {
  onStart: () => void;
};

const riskColors: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  moderate: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const riskLabels: Record<string, string> = {
  excellent: 'Foarte bine', good: 'Bine', moderate: 'Risc moderat', high: 'Risc ridicat',
};

const SecurityQuizLanding = ({ onStart }: Props) => {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('security_quiz_attempts')
      .select('id, score, total_questions, risk_level, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setAttempts((data as Attempt[]) || []);
        setLoading(false);
      });
  }, [user]);

  const lastAttempt = attempts[0];
  const bestScore = attempts.length ? Math.max(...attempts.map(a => Math.round((a.score / a.total_questions) * 100))) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero Card */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden">
        <CardContent className="p-8 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Test de Siguranță Digitală</h1>
            <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
              Testează-ți cunoștințele de securitate online printr-un test scurt și practic.
              Învață să recunoști tentativele de fraudă și să te protejezi eficient.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> ~5-7 minute</span>
            <span className="flex items-center gap-1.5"><Award className="w-4 h-4" /> 15 întrebări</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Feedback instant</span>
          </div>
          <Button size="lg" onClick={onStart} className="gap-2 text-base px-8">
            <Play className="w-5 h-5" /> Începe Testul
          </Button>
        </CardContent>
      </Card>

      {/* Last attempt summary */}
      {lastAttempt && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Ultima completare</h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-2xl font-bold">{Math.round((lastAttempt.score / lastAttempt.total_questions) * 100)}%</p>
                <p className="text-xs text-muted-foreground">{lastAttempt.score}/{lastAttempt.total_questions} corecte</p>
              </div>
              <Badge className={riskColors[lastAttempt.risk_level]}>{riskLabels[lastAttempt.risk_level]}</Badge>
              <p className="text-sm text-muted-foreground ml-auto">
                {format(new Date(lastAttempt.completed_at), 'd MMM yyyy, HH:mm', { locale: ro })}
              </p>
            </div>
            {bestScore !== null && bestScore > Math.round((lastAttempt.score / lastAttempt.total_questions) * 100) && (
              <p className="text-xs text-muted-foreground mt-2">Cel mai bun scor: {bestScore}%</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* History table */}
      {attempts.length > 1 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Istoric încercări</h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Scor</TableHead>
                    <TableHead>Nivel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        {format(new Date(a.completed_at), 'd MMM yyyy, HH:mm', { locale: ro })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {Math.round((a.score / a.total_questions) * 100)}% ({a.score}/{a.total_questions})
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={riskColors[a.risk_level]}>
                          {riskLabels[a.risk_level]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecurityQuizLanding;
