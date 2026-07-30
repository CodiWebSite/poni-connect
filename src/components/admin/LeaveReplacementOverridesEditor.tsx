import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, ArrowLeftRight, UserCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
}

interface OverrideRow {
  id: string;
  employee_epd_id: string;
  replacement_epd_id: string;
}

const fullName = (e?: Employee) => (e ? `${e.last_name} ${e.first_name}` : '—');

const LeaveReplacementOverridesEditor = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchEmp, setSearchEmp] = useState('');
  const [searchRep, setSearchRep] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [bidirectional, setBidirectional] = useState(true);
  const [filter, setFilter] = useState('');

  const empMap = useMemo(() => {
    const m: Record<string, Employee> = {};
    employees.forEach(e => { m[e.id] = e; });
    return m;
  }, [employees]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: emps }, { data: ovr }] = await Promise.all([
      supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department')
        .eq('is_archived', false)
        .order('last_name'),
      supabase
        .from('leave_replacement_overrides')
        .select('id, employee_epd_id, replacement_epd_id'),
    ]);
    setEmployees(emps || []);
    setRows(ovr || []);
    setLoading(false);
  };

  const matches = (e: Employee, q: string) =>
    !q || `${e.last_name} ${e.first_name} ${e.department || ''}`.toLowerCase().includes(q.toLowerCase());

  const empOptions = useMemo(
    () => employees.filter(e => matches(e, searchEmp)).slice(0, 50),
    [employees, searchEmp]
  );
  const repOptions = useMemo(
    () => employees.filter(e => e.id !== employeeId && matches(e, searchRep)).slice(0, 50),
    [employees, searchRep, employeeId]
  );

  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows
      .filter(r => {
        if (!q) return true;
        const a = fullName(empMap[r.employee_epd_id]).toLowerCase();
        const b = fullName(empMap[r.replacement_epd_id]).toLowerCase();
        return a.includes(q) || b.includes(q);
      })
      .sort((a, b) =>
        fullName(empMap[a.employee_epd_id]).localeCompare(fullName(empMap[b.employee_epd_id]))
      );
  }, [rows, filter, empMap]);

  const handleAdd = async () => {
    if (!employeeId || !replacementId) return;
    setSaving(true);
    const payload = [{ employee_epd_id: employeeId, replacement_epd_id: replacementId }];
    if (bidirectional) payload.push({ employee_epd_id: replacementId, replacement_epd_id: employeeId });

    const { error } = await supabase
      .from('leave_replacement_overrides')
      .upsert(payload, { onConflict: 'employee_epd_id,replacement_epd_id', ignoreDuplicates: true });

    setSaving(false);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Excepție adăugată', description: 'Opțiunea de înlocuitor a fost salvată.' });
    setEmployeeId('');
    setReplacementId('');
    setSearchEmp('');
    setSearchRep('');
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('leave_replacement_overrides').delete().eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="w-4 h-4 text-primary" />
            Excepții înlocuitori concediu
          </CardTitle>
          <CardDescription>
            Permite unui angajat să aleagă ca înlocuitor un coleg din alt departament.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Angajat (cel care cere concediu)</Label>
              <Input
                placeholder="Caută după nume sau departament..."
                value={searchEmp}
                onChange={e => setSearchEmp(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                {empOptions.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEmployeeId(e.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${employeeId === e.id ? 'bg-primary/10 font-semibold' : ''}`}
                  >
                    {fullName(e)}
                    <span className="block text-[10px] text-muted-foreground truncate">{e.department || '—'}</span>
                  </button>
                ))}
                {empOptions.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Niciun rezultat</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Înlocuitor permis</Label>
              <Input
                placeholder="Caută după nume sau departament..."
                value={searchRep}
                onChange={e => setSearchRep(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                {repOptions.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setReplacementId(e.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${replacementId === e.id ? 'bg-primary/10 font-semibold' : ''}`}
                  >
                    {fullName(e)}
                    <span className="block text-[10px] text-muted-foreground truncate">{e.department || '—'}</span>
                  </button>
                ))}
                {repOptions.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Niciun rezultat</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={bidirectional} onCheckedChange={v => setBidirectional(!!v)} />
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Adaugă și în sens invers (reciproc)
            </label>
            <Button size="sm" onClick={handleAdd} disabled={!employeeId || !replacementId || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adaugă excepție
            </Button>
          </div>

          {(employeeId || replacementId) && (
            <p className="text-xs text-muted-foreground">
              Selecție: <Badge variant="secondary">{fullName(empMap[employeeId])}</Badge>
              {' → '}
              <Badge variant="secondary">{fullName(empMap[replacementId])}</Badge>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Excepții active ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Filtrează lista..." value={filter} onChange={e => setFilter(e.target.value)} />
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nicio excepție configurată.</p>
          ) : (
            <div className="space-y-2">
              {visibleRows.map(r => (
                <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card text-sm">
                  <span className="font-medium truncate">{fullName(empMap[r.employee_epd_id])}</span>
                  <span className="text-muted-foreground text-xs">poate alege</span>
                  <span className="font-medium truncate">{fullName(empMap[r.replacement_epd_id])}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-8 w-8 text-destructive"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveReplacementOverridesEditor;
