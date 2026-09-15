import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

type Employee = { user_id: string; full_name: string | null; department: string | null; position: string | null };
type Coordinator = { user_id: string | null; full_name: string };

const DoctoralAccessPanel = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [withAccess, setWithAccess] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [thesis, setThesis] = useState('');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [studyYear, setStudyYear] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: staff }, { data: coords }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('user_id,full_name,department,position').order('full_name'),
      supabase.from('doctoral_coordinators').select('user_id,full_name').eq('is_active', true).order('full_name'),
      supabase.from('user_roles').select('user_id,role').eq('role', 'doctorand'),
    ]);
    setEmployees((staff || []) as Employee[]);
    setCoordinators(((coords || []) as Coordinator[]).filter((c) => c.user_id));
    setWithAccess(((roles || []) as { user_id: string }[]).map((r) => r.user_id));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = employees.filter((e) => withAccess.includes(e.user_id));
    if (!query) return list;
    return list.filter((e) => (e.full_name || '').toLowerCase().includes(query));
  }, [employees, withAccess, search]);

  const candidates = useMemo(
    () => employees.filter((e) => !withAccess.includes(e.user_id)),
    [employees, withAccess],
  );

  const grant = async () => {
    if (!selected) { toast.error('Alege colegul care este și doctorand'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('grant_doctoral_access', {
      _user_id: selected,
      _thesis_title: thesis.trim() || null,
      _coordinator_user_id: coordinatorId || null,
      _study_year: studyYear ? Number(studyYear) : null,
    });
    setSaving(false);
    if (error) { toast.error('Accesul nu a putut fi acordat'); return; }
    toast.success('Acces acordat. Colegul vede „Parcursul meu doctoral" în meniul lui.');
    setSelected(''); setThesis(''); setCoordinatorId(''); setStudyYear('');
    await load();
  };

  const revoke = async (userId: string, name: string) => {
    if (!window.confirm(`Retragi accesul doctoral pentru ${name}?`)) return;
    const { error } = await supabase.rpc('revoke_doctoral_access', { _user_id: userId });
    if (error) { toast.error('Accesul nu a putut fi retras'); return; }
    toast.success('Acces doctoral retras');
    await load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" />Dă acces la Spațiul Doctoral unui angajat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Coleg angajat</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Alege colegul" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {candidates.map((item) => (
                    <SelectItem key={item.user_id} value={item.user_id}>
                      {item.full_name || 'Fără nume'}{item.department ? ` · ${item.department}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Păstrează tot ce are ca angajat și primește în plus portalul doctoral.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-thesis">Titlul tezei</Label>
              <Input id="acc-thesis" value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Titlul tezei de doctorat" />
            </div>
            <div className="space-y-2">
              <Label>Conducător de doctorat</Label>
              <Select value={coordinatorId} onValueChange={setCoordinatorId}>
                <SelectTrigger><SelectValue placeholder="Alege conducătorul" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {coordinators.map((item) => (
                    <SelectItem key={item.user_id!} value={item.user_id!}>{item.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-year">Anul de studiu</Label>
              <Input id="acc-year" type="number" min={1} max={6} value={studyYear} onChange={(e) => setStudyYear(e.target.value)} />
            </div>
          </div>
          <Button onClick={grant} disabled={saving}>{saving ? 'Se salvează...' : 'Acordă acces doctoral'}</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold"><GraduationCap className="h-4 w-4" />Colegi cu acces doctoral</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="h-9 w-56 pl-8" placeholder="Caută după nume" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Badge variant="outline">{filtered.length}</Badge>
          </div>
        </div>
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">Nimeni nu are încă acces doctoral din listă.</p>}
        {filtered.map((item) => (
          <article key={item.user_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
            <div>
              <p className="font-semibold">{item.full_name || 'Fără nume'}</p>
              <p className="text-sm text-muted-foreground">{item.department || 'Departament necompletat'}</p>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(item.user_id, item.full_name || 'colegul selectat')}>
              <X className="mr-1 h-4 w-4" />Retrage accesul
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
};

export default DoctoralAccessPanel;
