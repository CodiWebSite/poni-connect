import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, Plus, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

type Coordinator = {
  id: string;
  user_id: string | null;
  full_name: string;
  academic_title: string | null;
  doctoral_school: string | null;
  research_field: string | null;
  email: string | null;
  max_students: number | null;
  is_active: boolean;
};

type EmployeeOption = { user_id: string; full_name: string | null; department: string | null; position: string | null };

const emptyForm = { userId: '', fullName: '', academicTitle: '', doctoralSchool: '', researchField: '', email: '', maxStudents: '' };

const DoctoralCoordinatorsPanel = () => {
  const [rows, setRows] = useState<Coordinator[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: coordinators, error }, { data: staff }, { data: assigned }] = await Promise.all([
      supabase.from('doctoral_coordinators').select('id,user_id,full_name,academic_title,doctoral_school,research_field,email,max_students,is_active').order('full_name'),
      supabase.from('profiles').select('user_id,full_name,department,position').order('full_name'),
      supabase.from('doctoral_profiles').select('coordinator_user_id'),
    ]);
    if (error) { toast.error('Lista conducătorilor nu a putut fi încărcată'); return; }
    setRows((coordinators || []) as Coordinator[]);
    setEmployees((staff || []) as EmployeeOption[]);
    const tally: Record<string, number> = {};
    (assigned || []).forEach((row: { coordinator_user_id: string | null }) => {
      if (row.coordinator_user_id) tally[row.coordinator_user_id] = (tally[row.coordinator_user_id] || 0) + 1;
    });
    setCounts(tally);
  }, []);

  useEffect(() => { load(); }, [load]);

  const availableEmployees = useMemo(
    () => employees.filter((item) => !rows.some((row) => row.user_id === item.user_id)),
    [employees, rows],
  );

  const pickEmployee = (userId: string) => {
    const found = employees.find((item) => item.user_id === userId);
    setForm((prev) => ({ ...prev, userId, fullName: found?.full_name || prev.fullName }));
  };

  const addCoordinator = async () => {
    if (!form.fullName.trim()) { toast.error('Alege colegul sau scrie numele conducătorului'); return; }
    setSaving(true);
    const { error } = await supabase.from('doctoral_coordinators').insert({
      user_id: form.userId || null,
      full_name: form.fullName.trim(),
      academic_title: form.academicTitle.trim() || null,
      doctoral_school: form.doctoralSchool.trim() || null,
      research_field: form.researchField.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      max_students: form.maxStudents ? Number(form.maxStudents) : null,
    });
    setSaving(false);
    if (error) { toast.error('Conducătorul nu a putut fi adăugat'); return; }
    toast.success('Conducător adăugat. Apare în lista de la înregistrarea doctoranzilor.');
    setForm(emptyForm);
    await load();
  };

  const toggleActive = async (row: Coordinator, value: boolean) => {
    const { error } = await supabase.from('doctoral_coordinators').update({ is_active: value }).eq('id', row.id);
    if (error) { toast.error('Modificarea nu a putut fi salvată'); return; }
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, is_active: value } : item)));
  };

  const removeCoordinator = async (row: Coordinator) => {
    const { error } = await supabase.from('doctoral_coordinators').delete().eq('id', row.id);
    if (error) { toast.error('Conducătorul nu a putut fi eliminat'); return; }
    toast.success('Conducător eliminat din listă');
    await load();
  };

  const linkAccount = async (row: Coordinator, userId: string) => {
    const { error } = await supabase.from('doctoral_coordinators').update({ user_id: userId }).eq('id', row.id);
    if (error) { toast.error('Contul nu a putut fi conectat'); return; }
    toast.success('Cont conectat — conducătorul are acum acces la doctoranzii lui');
    await load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" />Adaugă un conducător de doctorat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Coleg cu cont în platformă</Label>
              <Select value={form.userId} onValueChange={pickEmployee}>
                <SelectTrigger><SelectValue placeholder="Alege din listă (recomandat)" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {availableEmployees.map((item) => (
                    <SelectItem key={item.user_id} value={item.user_id}>
                      {item.full_name || 'Fără nume'}{item.department ? ` · ${item.department}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Contul ales primește automat acces la doctoranzii alocați.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coord-name">Nume afișat</Label>
              <Input id="coord-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Prof. dr. Ion Popescu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coord-title">Titlu academic</Label>
              <Input id="coord-title" value={form.academicTitle} onChange={(e) => setForm({ ...form, academicTitle: e.target.value })} placeholder="CS I, prof. univ. dr." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coord-school">Școala doctorală</Label>
              <Input id="coord-school" value={form.doctoralSchool} onChange={(e) => setForm({ ...form, doctoralSchool: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coord-field">Domeniu de cercetare</Label>
              <Input id="coord-field" value={form.researchField} onChange={(e) => setForm({ ...form, researchField: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coord-email">E-mail</Label>
                <Input id="coord-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nume@icmpp.ro" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coord-max">Locuri disponibile</Label>
                <Input id="coord-max" type="number" min={1} value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} />
              </div>
            </div>
          </div>
          <Button onClick={addCoordinator} disabled={saving}>{saving ? 'Se salvează...' : 'Adaugă conducător'}</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><GraduationCap className="h-4 w-4" />Conducători înregistrați</h3>
          <Badge variant="outline">{rows.length} conducători</Badge>
        </div>
        {rows.length === 0 && <p className="py-10 text-center text-muted-foreground">Nu există conducători în listă. Adaugă primul mai sus.</p>}
        {rows.map((row) => (
          <article key={row.id} className="grid gap-3 border-b border-border py-4 last:border-0 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{row.full_name}</p>
                {row.academic_title && <Badge variant="secondary">{row.academic_title}</Badge>}
                {!row.user_id && <Badge variant="outline" className="text-amber-600">Fără cont conectat</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.email || 'e-mail necompletat'} · {row.doctoral_school || 'școală necompletată'}</p>
            </div>
            <div className="text-sm">
              <p>{row.research_field || 'Domeniu necompletat'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.user_id ? `${counts[row.user_id] || 0} doctoranzi alocați` : 'Conectează un cont pentru acces'}
                {row.max_students ? ` · maxim ${row.max_students}` : ''}
              </p>
              {!row.user_id && (
                <Select onValueChange={(value) => linkAccount(row, value)}>
                  <SelectTrigger className="mt-2 h-9"><SelectValue placeholder="Conectează cont" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {availableEmployees.map((item) => (
                      <SelectItem key={item.user_id} value={item.user_id}>{item.full_name || 'Fără nume'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={row.is_active} onCheckedChange={(value) => toggleActive(row, value)} aria-label="Activ la înregistrare" />
                <span className="text-xs text-muted-foreground">{row.is_active ? 'Vizibil la înregistrare' : 'Ascuns'}</span>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive" aria-label="Elimină conducătorul" onClick={() => removeCoordinator(row)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </article>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Conducătorii cu cont conectat găsesc doctoranzii lor la „Doctoranzii mei” și pot stabili termene, valida documente și lăsa feedback.
      </p>
    </div>
  );
};

export default DoctoralCoordinatorsPanel;
