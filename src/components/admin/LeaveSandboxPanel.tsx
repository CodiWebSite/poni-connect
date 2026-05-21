import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FlaskConical, Trash2, Send, RefreshCw, ShieldCheck, AlertTriangle, User2 } from 'lucide-react';

interface EmployeeOption {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  employee_record_id: string | null;
}

interface ApproverResolution {
  source: 'individual' | 'department' | 'none';
  approverUserId: string | null;
  approverName: string;
  notes: string;
}

interface DemoRequest {
  id: string;
  request_number: string;
  user_id: string;
  epd_id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status: string;
  approver_id: string | null;
  created_at: string;
  employee_name?: string;
  approver_name?: string;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function LeaveSandboxPanel() {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const { isDemo, toggleDemo } = useDemoMode();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [selectedEpdId, setSelectedEpdId] = useState<string>('');
  const [approver, setApprover] = useState<ApproverResolution | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [startDate, setStartDate] = useState(addDays(new Date(), 30));
  const [endDate, setEndDate] = useState(addDays(new Date(), 32));

  const [submitting, setSubmitting] = useState(false);
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEpdId) || null,
    [selectedEpdId, employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return employees.slice(0, 100);
    return employees
      .filter(e =>
        `${e.last_name} ${e.first_name} ${e.department || ''}`.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [searchTerm, employees]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      setLoadingEmp(true);
      const { data, error } = await supabase
        .from('employee_personal_data')
        .select('id, first_name, last_name, department, position, employee_record_id, is_archived')
        .eq('is_archived', false)
        .order('last_name', { ascending: true })
        .limit(2000);
      if (error) {
        toast({ title: 'Eroare', description: 'Nu am putut încărca angajații.', variant: 'destructive' });
      } else {
        // Resolve user_id via employee_records for each
        const recordIds = [...new Set((data || []).map(e => e.employee_record_id).filter(Boolean))] as string[];
        const userMap: Record<string, string> = {};
        if (recordIds.length > 0) {
          const { data: recs } = await supabase
            .from('employee_records')
            .select('id, user_id')
            .in('id', recordIds);
          (recs || []).forEach((r: any) => { if (r.user_id) userMap[r.id] = r.user_id; });
        }
        setEmployees((data || []).map((e: any) => ({
          id: e.id,
          user_id: e.employee_record_id ? (userMap[e.employee_record_id] || null) : null,
          first_name: e.first_name,
          last_name: e.last_name,
          department: e.department,
          position: e.position,
          employee_record_id: e.employee_record_id,
        })));
      }
      setLoadingEmp(false);
    })();
    fetchDemoRequests();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!selectedEmployee) { setApprover(null); return; }
    (async () => {
      const res = await resolveApproverFor(selectedEmployee);
      setApprover(res);
    })();
  }, [selectedEmployee?.id]);

  async function resolveApproverFor(emp: EmployeeOption): Promise<ApproverResolution> {
    // 1) Individual mapping in leave_approvers
    if (emp.user_id) {
      const { data: ind } = await supabase
        .from('leave_approvers')
        .select('approver_user_id, approver_email')
        .eq('employee_user_id', emp.user_id)
        .limit(1)
        .maybeSingle();
      if (ind?.approver_user_id) {
        const name = await resolveName(ind.approver_user_id);
        return {
          source: 'individual',
          approverUserId: ind.approver_user_id,
          approverName: name || ind.approver_email || 'Necunoscut',
          notes: 'Aprobator desemnat individual (leave_approvers)',
        };
      }
    }
    // 2) Department fallback
    if (emp.department) {
      const { data: dep } = await supabase
        .from('leave_department_approvers')
        .select('approver_user_id, approver_email')
        .eq('department', emp.department)
        .limit(1)
        .maybeSingle();
      if (dep?.approver_user_id) {
        const name = await resolveName(dep.approver_user_id);
        return {
          source: 'department',
          approverUserId: dep.approver_user_id,
          approverName: name || dep.approver_email || 'Necunoscut',
          notes: `Aprobator pe departament: ${emp.department}`,
        };
      }
    }
    return { source: 'none', approverUserId: null, approverName: '—', notes: 'Niciun aprobator configurat' };
  }

  async function resolveName(userId: string): Promise<string | null> {
    const { data } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
    return data?.full_name || null;
  }

  async function fetchDemoRequests() {
    setLoadingDemo(true);
    const q: any = supabase.from('leave_requests').select('*').eq('is_demo', true).order('created_at', { ascending: false }).limit(50);
    const { data, error } = await q as { data: any[] | null; error: any };
    if (error) {
      toast({ title: 'Eroare', description: 'Nu am putut încărca cererile demo.', variant: 'destructive' });
      setLoadingDemo(false);
      return;
    }
    // Resolve names via profiles (fallback robust)
    const userIds = [...new Set((data || []).flatMap(r => [r.user_id, r.approver_id]).filter(Boolean))] as string[];
    const nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      (profs || []).forEach((p: any) => { if (p.full_name) nameMap[p.user_id] = p.full_name; });
    }
    setDemoRequests((data || []).map((r: any) => ({
      ...r,
      employee_name: nameMap[r.user_id] || '—',
      approver_name: r.approver_id ? (nameMap[r.approver_id] || '—') : '—',
    })));
    setLoadingDemo(false);
  }

  async function submitDemoRequest() {
    if (!user || !selectedEmployee) return;
    if (!selectedEmployee.user_id) {
      toast({
        title: 'Angajat fără cont',
        description: 'Acest angajat nu are user_id linkat. Alege un angajat cu cont activ pentru test complet.',
        variant: 'destructive',
      });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast({ title: 'Date invalide', description: 'Data de start trebuie să fie ≤ data de sfârșit.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    // Working days = simple count of weekdays in range
    const wd = countWorkingDays(startDate, endDate);

    const payload: any = {
      user_id: selectedEmployee.user_id,
      epd_id: selectedEmployee.id,
      start_date: startDate,
      end_date: endDate,
      working_days: wd,
      year: new Date(startDate).getFullYear(),
      replacement_name: '[DEMO TEST] Înlocuitor de test',
      replacement_position: 'N/A',
      status: 'pending_department_head',
      employee_signature: 'DEMO_SIGNATURE',
      employee_signed_at: new Date().toISOString(),
      director_approved_at: new Date().toISOString(),
      approver_id: approver?.approverUserId || null,
      is_demo: true,
    };

    const { data: inserted, error } = await (supabase.from('leave_requests') as any).insert(payload).select('id, request_number').single();
    setSubmitting(false);

    if (error) {
      toast({ title: 'Eroare la creare cerere demo', description: error.message, variant: 'destructive' });
      return;
    }

    // Optional [DEMO] in-app notification only to the approver (no emails, no colleague notifications)
    if (approver?.approverUserId) {
      await supabase.from('notifications').insert({
        user_id: approver.approverUserId,
        title: '[DEMO] Cerere de concediu de test',
        message: `[DEMO] Cerere ${inserted.request_number} pentru ${selectedEmployee.last_name} ${selectedEmployee.first_name} (${wd} zile, ${startDate} – ${endDate}). Aceasta este o cerere de TEST creată de un super_admin — NU produce efecte reale.`,
        type: 'info',
        related_type: 'leave_request',
        related_id: inserted.id,
      });
    }

    toast({
      title: '[DEMO] Cerere creată',
      description: `Cererea ${inserted.request_number} a fost creată în mod demo. Activează "Demo Mode" și mergi la /leave-request → "De Aprobat" cu contul aprobatorului pentru verificare.`,
    });
    fetchDemoRequests();
  }

  function countWorkingDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    let c = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) c++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(c, 0);
  }

  async function deleteOne(id: string) {
    const { error } = await (supabase.from('leave_requests') as any).delete().eq('id', id).eq('is_demo', true);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Șters', description: 'Cererea demo a fost ștearsă.' });
    fetchDemoRequests();
  }

  async function cleanupAll() {
    if (!confirm('Sigur ștergi TOATE cererile demo? Această acțiune este ireversibilă, dar nu afectează cereri reale.')) return;
    setCleaning(true);
    const { error } = await (supabase.from('leave_requests') as any).delete().eq('is_demo', true);
    setCleaning(false);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Curățat', description: 'Toate cererile demo au fost șterse.' });
    fetchDemoRequests();
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Acces restricționat. Doar super_admin.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-purple-300/60 dark:border-purple-500/30 bg-purple-50/40 dark:bg-purple-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-200">
            <FlaskConical className="w-5 h-5" />
            Test Flux Concediu — Aprobatori (Sandbox)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-white/70 dark:bg-background/40 border border-purple-200 dark:border-purple-500/20 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium text-purple-900 dark:text-purple-200">
              <ShieldCheck className="w-4 h-4" /> Garanții sandbox
            </div>
            <ul className="list-disc ml-6 text-xs text-muted-foreground space-y-0.5">
              <li>Toate cererile au <code>is_demo = true</code>.</li>
              <li>Nu se trimit emailuri (form-ul și aprobarea sar peste notify în demo).</li>
              <li>Nu se scad zile reale de concediu la aprobare (logica existentă verifică isDemo).</li>
              <li>O singură notificare in-app marcată <code>[DEMO]</code> ajunge la aprobatorul desemnat — colegii nu sunt anunțați.</li>
              <li>Pot fi șterse complet cu un click.</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              Demo Mode global este <strong>{isDemo ? 'PORNIT' : 'OPRIT'}</strong>. Listele de concedii (Cererile mele, De Aprobat, Centralizator, HR) afișează cererile demo doar când Demo Mode e PORNIT.
            </span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={toggleDemo}>
              {isDemo ? 'Oprește Demo Mode' : 'Pornește Demo Mode'}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Caută angajat (nume / departament)</Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ex: Marin, Luminita, sef laborator..."
              />
              <Label className="mt-2">Angajat solicitant</Label>
              <Select value={selectedEpdId} onValueChange={setSelectedEpdId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingEmp ? 'Se încarcă...' : 'Selectează angajat'} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {filteredEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.last_name} {e.first_name}
                      {e.department ? ` — ${e.department}` : ''}
                      {!e.user_id ? ' (fără cont)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEmployee && (
                <div className="text-xs text-muted-foreground">
                  Poziție: {selectedEmployee.position || '—'} · Cont: {selectedEmployee.user_id ? '✅ activ' : '❌ fără cont'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Aprobator rezolvat automat</Label>
              <div className="rounded-md border bg-background p-3 text-sm min-h-[88px]">
                {!selectedEmployee && <span className="text-muted-foreground">Selectează un angajat...</span>}
                {selectedEmployee && !approver && <Loader2 className="w-4 h-4 animate-spin" />}
                {approver && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User2 className="w-4 h-4" />
                      <span className="font-medium">{approver.approverName}</span>
                      <Badge variant={approver.source === 'none' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {approver.source === 'individual' && 'Individual'}
                        {approver.source === 'department' && 'Departament'}
                        {approver.source === 'none' && 'Lipsă'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{approver.notes}</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Start</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>Sfârșit</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={submitDemoRequest}
            disabled={!selectedEmployee || submitting}
            className="w-full md:w-auto"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Trimite cerere de TEST [DEMO]
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> Cereri demo existente
            <Badge variant="outline">{demoRequests.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDemoRequests}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reîncarcă
            </Button>
            <Button variant="destructive" size="sm" onClick={cleanupAll} disabled={cleaning || demoRequests.length === 0}>
              {cleaning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Șterge toate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDemo ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : demoRequests.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">Nicio cerere demo. Creează una mai sus.</div>
          ) : (
            <div className="space-y-2">
              {demoRequests.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-md border bg-card p-3 text-sm">
                  <div>
                    <div className="font-medium">
                      <Badge variant="secondary" className="mr-2 text-[10px]">{r.request_number}</Badge>
                      {r.employee_name} <span className="text-muted-foreground">→</span> {r.approver_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.start_date} – {r.end_date} · {r.working_days} zile · status: {r.status}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteOne(r.id)}>
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
}
