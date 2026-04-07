import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Pencil, BarChart3, Users, Award, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

type Question = {
  id: string;
  category: string;
  question_type: string;
  question_text: string;
  scenario_text?: string | null;
  options: any;
  correct_answers: any;
  explanation?: string | null;
  difficulty: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
};

type Attempt = {
  id: string;
  user_id: string;
  score: number;
  total_questions: number;
  risk_level: string;
  completed_at: string;
  answers: any;
};

const categories = [
  { value: 'phishing', label: 'Phishing' },
  { value: 'phone_fraud', label: 'Fraudă telefonică' },
  { value: 'bank_data', label: 'Date bancare' },
  { value: 'remote_access', label: 'Acces la distanță' },
  { value: 'fake_investments', label: 'Investiții false' },
];

const questionTypes = [
  { value: 'single_choice', label: 'Alegere unică' },
  { value: 'multiple_choice', label: 'Alegere multiplă' },
  { value: 'true_false', label: 'Adevărat / Fals' },
  { value: 'scenario', label: 'Scenariu' },
];

const emptyQuestion = {
  category: 'phishing',
  question_type: 'single_choice',
  question_text: '',
  scenario_text: '',
  options: ['', '', '', ''],
  correct_answers: [0],
  explanation: '',
  difficulty: 'medium',
  is_active: true,
  order_index: 0,
};

const SecurityQuizAdminPanel = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyQuestion);
  const [filterCat, setFilterCat] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    const [qRes, aRes] = await Promise.all([
      supabase.from('security_quiz_questions').select('*').order('order_index'),
      supabase.from('security_quiz_attempts').select('*').order('completed_at', { ascending: false }).limit(500),
    ]);
    setQuestions((qRes.data as Question[]) || []);
    setAttempts((aRes.data as Attempt[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const cleanOptions = form.options.filter((o: string) => o.trim());
    if (!form.question_text.trim() || cleanOptions.length < 2) {
      toast.error('Completează cel puțin textul întrebării și 2 opțiuni.');
      return;
    }

    const payload = {
      ...form,
      options: cleanOptions,
      correct_answers: form.correct_answers,
      created_by: user?.id,
    };

    if (editingId) {
      const { error } = await supabase.from('security_quiz_questions').update(payload).eq('id', editingId);
      if (error) { toast.error('Eroare la salvare'); return; }
      toast.success('Întrebare actualizată');
    } else {
      const { error } = await supabase.from('security_quiz_questions').insert(payload);
      if (error) { toast.error('Eroare la creare'); return; }
      toast.success('Întrebare adăugată');
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyQuestion);
    fetchData();
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({
      category: q.category,
      question_type: q.question_type,
      question_text: q.question_text,
      scenario_text: q.scenario_text || '',
      options: Array.isArray(q.options) ? q.options : [],
      correct_answers: Array.isArray(q.correct_answers) ? q.correct_answers : [],
      explanation: q.explanation || '',
      difficulty: q.difficulty,
      is_active: q.is_active,
      order_index: q.order_index,
    });
    setDialogOpen(true);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('security_quiz_questions').update({ is_active: !current }).eq('id', id);
    fetchData();
  };

  const filtered = filterCat === 'all' ? questions : questions.filter(q => q.category === filterCat);

  // Stats
  const totalAttempts = attempts.length;
  const uniqueUsers = new Set(attempts.map(a => a.user_id)).size;
  const avgScore = totalAttempts ? Math.round(attempts.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / totalAttempts) : 0;

  // Per-question correct rate
  const questionStats: Record<string, { correct: number; total: number }> = {};
  attempts.forEach(a => {
    const ans = Array.isArray(a.answers) ? a.answers : [];
    ans.forEach((item: any) => {
      if (!questionStats[item.question_id]) questionStats[item.question_id] = { correct: 0, total: 0 };
      questionStats[item.question_id].total++;
      if (item.correct) questionStats[item.question_id].correct++;
    });
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions" className="gap-1.5"><Target className="w-4 h-4" /> Întrebări</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Statistici</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate categoriile</SelectItem>
                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyQuestion); } }}>
              <DialogTrigger asChild>
                <Button className="gap-1.5"><Plus className="w-4 h-4" /> Adaugă întrebare</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Editează întrebarea' : 'Întrebare nouă'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Categorie</Label>
                      <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tip întrebare</Label>
                      <Select value={form.question_type} onValueChange={v => setForm(f => ({ ...f, question_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{questionTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(form.question_type === 'scenario') && (
                    <div>
                      <Label>Text scenariu</Label>
                      <Textarea value={form.scenario_text} onChange={e => setForm(f => ({ ...f, scenario_text: e.target.value }))} />
                    </div>
                  )}

                  <div>
                    <Label>Textul întrebării</Label>
                    <Textarea value={form.question_text} onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))} />
                  </div>

                  <div>
                    <Label>Opțiuni (câte una per rând)</Label>
                    {form.options.map((opt: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 mt-1.5">
                        <input
                          type={form.question_type === 'multiple_choice' ? 'checkbox' : 'radio'}
                          checked={form.correct_answers.includes(i)}
                          onChange={() => {
                            if (form.question_type === 'multiple_choice') {
                              setForm(f => ({
                                ...f,
                                correct_answers: f.correct_answers.includes(i)
                                  ? f.correct_answers.filter((x: number) => x !== i)
                                  : [...f.correct_answers, i],
                              }));
                            } else {
                              setForm(f => ({ ...f, correct_answers: [i] }));
                            }
                          }}
                          className="accent-primary"
                        />
                        <Input
                          value={opt}
                          onChange={e => {
                            const newOpts = [...form.options];
                            newOpts[i] = e.target.value;
                            setForm(f => ({ ...f, options: newOpts }));
                          }}
                          placeholder={`Opțiunea ${i + 1}`}
                        />
                        {form.options.length > 2 && (
                          <Button variant="ghost" size="sm" onClick={() => {
                            const newOpts = form.options.filter((_: any, j: number) => j !== i);
                            const newCorrect = form.correct_answers.filter((x: number) => x !== i).map((x: number) => x > i ? x - 1 : x);
                            setForm(f => ({ ...f, options: newOpts, correct_answers: newCorrect }));
                          }}>✕</Button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, options: [...f.options, ''] }))} className="mt-2">
                      + Adaugă opțiune
                    </Button>
                  </div>

                  <div>
                    <Label>Explicație (afișată după test)</Label>
                    <Textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Dificultate</Label>
                      <Select value={form.difficulty} onValueChange={v => setForm(f => ({ ...f, difficulty: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Ușoară</SelectItem>
                          <SelectItem value="medium">Medie</SelectItem>
                          <SelectItem value="hard">Dificilă</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Ordine</Label>
                      <Input type="number" value={form.order_index} onChange={e => setForm(f => ({ ...f, order_index: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Anulează</Button>
                  <Button onClick={handleSave}>Salvează</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Questions table */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Întrebare</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Rată corect</TableHead>
                      <TableHead>Activ</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((q, i) => {
                      const stats = questionStats[q.id];
                      const rate = stats ? Math.round((stats.correct / stats.total) * 100) : null;
                      return (
                        <TableRow key={q.id}>
                          <TableCell className="font-mono text-xs">{q.order_index}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{q.question_text}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {categories.find(c => c.value === q.category)?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {questionTypes.find(t => t.value === q.question_type)?.label}
                          </TableCell>
                          <TableCell>
                            {rate !== null ? (
                              <span className={rate >= 70 ? 'text-green-600' : rate >= 40 ? 'text-orange-600' : 'text-red-600'}>
                                {rate}%
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            <Switch checked={q.is_active} onCheckedChange={() => toggleActive(q.id, q.is_active)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(q)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-5 text-center">
                <Users className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{uniqueUsers}</p>
                <p className="text-xs text-muted-foreground">Utilizatori unici</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-5 text-center">
                <Award className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{totalAttempts}</p>
                <p className="text-xs text-muted-foreground">Total completări</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-5 text-center">
                <BarChart3 className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{avgScore}%</p>
                <p className="text-xs text-muted-foreground">Scor mediu</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent attempts */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-3">Ultimele completări</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Scor</TableHead>
                      <TableHead>Nivel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.slice(0, 20).map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">
                          {format(new Date(a.completed_at), 'd MMM yyyy, HH:mm', { locale: ro })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {Math.round((a.score / a.total_questions) * 100)}%
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{a.risk_level}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityQuizAdminPanel;
