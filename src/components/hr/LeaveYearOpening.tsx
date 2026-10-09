import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ReauthDialog from '@/components/shared/ReauthDialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Lock, Pencil, Play } from 'lucide-react';

export const STANDARD_DAYS = 35;
const NEW_YEAR = 2027;
const OLD_CARRY_YEAR = 2025;
const OLD_CARRY_DEADLINE = '30.06.2027';

interface Row {
  id: string; name: string; department: string | null;
  total: number; used: number; bonusPrev: number;
  carryOld: number; entitlement: number | null; reason: string | null;
}

/** Report din anul precedent = sold anual + bonus - zile folosite (minim 0). */
export function prevYearLeftover(total: number, bonus: number, used: number) {
  return Math.max(total + bonus - used, 0);
}

export default function LeaveYearOpening() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [opened, setOpened] = useState<{ opened_at: string; employees_count: number } | null>(null);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [editDays, setEditDays] = useState('');
  const [editReason, setEditReason] = useState('');
  const [reauth, setReauth] = useState<null | 'run' | 'close' | 'closeYear'>(null);
  const [closure, setClosure] = useState<{ closed_at: string; reason: string } | null>(null);
  const [yearOpen, setYearOpen] = useState(false);
  const [yearReason, setYearReason] = useState('');
  const [frozen, setFrozen] = useState<Map<string, number>>(new Map());
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const prev = NEW_YEAR - 1;
    const [epd, bonus, carry, ent, op] = await Promise.all([
      supabase.from('employee_personal_data').select('id, first_name, last_name, department, total_leave_days, used_leave_days').eq('is_archived', false).order('last_name'),
      supabase.from('leave_bonus').select('employee_personal_data_id, bonus_days').eq('year', prev),
      supabase.from('leave_carryover').select('employee_personal_data_id, remaining_days, from_year, to_year, closed_at').eq('from_year', OLD_CARRY_YEAR).is('closed_at', null),
      supabase.from('leave_year_entitlements').select('employee_personal_data_id, days, reason').eq('year', NEW_YEAR),
      supabase.from('leave_year_openings').select('opened_at, employees_count').eq('year', NEW_YEAR).maybeSingle(),
    ]);
    const [cl, fr] = await Promise.all([
      supabase.from('leave_year_closures').select('closed_at, reason').eq('year', prev).maybeSingle(),
      supabase.from('leave_carryover').select('employee_personal_data_id, initial_days').eq('from_year', prev).eq('to_year', NEW_YEAR),
    ]);
    setClosure(cl.data || null);
    setFrozen(new Map((fr.data || []).map((x) => [x.employee_personal_data_id, x.initial_days || 0])));
    const b = new Map<string, number>(); (bonus.data || []).forEach((x) => b.set(x.employee_personal_data_id, (b.get(x.employee_personal_data_id) || 0) + (x.bonus_days || 0)));
    // keep the latest (highest to_year) open 2025 carryover per person
    const c = new Map<string, { to: number; rem: number }>();
    (carry.data || []).forEach((x) => { const cur = c.get(x.employee_personal_data_id); if (!cur || x.to_year > cur.to) c.set(x.employee_personal_data_id, { to: x.to_year, rem: x.remaining_days || 0 }); });
    const e = new Map((ent.data || []).map((x) => [x.employee_personal_data_id, x]));
    setRows((epd.data || []).map((p) => ({
      id: p.id, name: `${p.last_name} ${p.first_name}`, department: p.department,
      total: p.total_leave_days || 0, used: p.used_leave_days || 0, bonusPrev: b.get(p.id) || 0,
      carryOld: c.get(p.id)?.rem || 0, entitlement: e.get(p.id)?.days ?? null, reason: e.get(p.id)?.reason ?? null,
    })));
    setOpened(op.data || null);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const saveEdit = async () => {
    if (!edit) return;
    const days = parseInt(editDays, 10);
    if (isNaN(days) || days < 0 || editReason.trim().length < 5) {
      toast({ title: 'Completați zilele și un motiv (minim 5 caractere)', variant: 'destructive' }); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('leave_year_entitlements').upsert({
      employee_personal_data_id: edit.id, year: NEW_YEAR, days, reason: editReason.trim(), updated_by: user?.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_personal_data_id,year' });
    if (error) { toast({ title: 'Eroare la salvare', variant: 'destructive' }); return; }
    if (opened) {
      // year already open: apply immediately
      const { data: epd } = await supabase.from('employee_personal_data').select('employee_record_id').eq('id', edit.id).single();
      await supabase.from('employee_personal_data').update({ total_leave_days: days }).eq('id', edit.id);
      if (epd?.employee_record_id) await supabase.from('employee_records').update({ total_leave_days: days }).eq('id', epd.employee_record_id);
      await supabase.rpc('recalculate_leave_balance', { target_epd_id: edit.id });
    }
    toast({ title: 'Sold 2027 salvat' });
    setEdit(null); load();
  };

  const runNow = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('open_leave_year', { _year: NEW_YEAR });
    setBusy(false);
    if (error) toast({ title: 'Eroare la deschiderea anului', description: error.message, variant: 'destructive' });
    else toast({ title: data ? `Anul ${NEW_YEAR} deschis pentru ${data} angajați` : `Anul ${NEW_YEAR} era deja deschis` });
    load();
  };

  const closeYear = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('close_leave_year', { _year: NEW_YEAR - 1, _reason: yearReason.trim() });
    setBusy(false);
    if (error) toast({ title: 'Eroare la închiderea anului', description: error.message, variant: 'destructive' });
    else toast({ title: `Anul ${NEW_YEAR - 1} închis`, description: `Report trecut în ${NEW_YEAR} pentru ${data} angajați.` });
    setYearOpen(false); setYearReason(''); load();
  };

  const closeOld = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('close_leave_carryover', { _from_year: OLD_CARRY_YEAR, _to_year: NEW_YEAR, _reason: closeReason.trim() });
    setBusy(false);
    if (error) toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    else toast({ title: `Report ${OLD_CARRY_YEAR} închis (${data} înregistrări)` });
    setCloseOpen(false); setCloseReason(''); load();
  };

  const pastDeadline = new Date() > new Date('2027-06-30T23:59:59');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" />Deschidere an {NEW_YEAR}</CardTitle>
          <CardDescription>
            Pe 1 ianuarie {NEW_YEAR}, la 00:05, sistemul trece automat ce a rămas din {NEW_YEAR - 1} ca report și setează {STANDARD_DAYS} de zile pentru toți.
            Reportul din {OLD_CARRY_YEAR} rămâne activ până îl închideți manual (termen orientativ {OLD_CARRY_DEADLINE}).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {opened
            ? <Badge variant="secondary">Deschis la {new Date(opened.opened_at).toLocaleString('ro-RO')} · {opened.employees_count} angajați</Badge>
            : <Badge variant="outline">Programat automat: 01.01.{NEW_YEAR}, 00:05</Badge>}
          {closure && <Badge variant="secondary">Anul {NEW_YEAR - 1} închis la {new Date(closure.closed_at).toLocaleString('ro-RO')}</Badge>}
          {!closure && !opened && <Button size="sm" variant="default" onClick={() => setYearOpen(true)} disabled={busy}><Lock className="w-4 h-4 mr-1" />Închide anul {NEW_YEAR - 1}</Button>}
          {!opened && <Button size="sm" variant="outline" onClick={() => setReauth('run')} disabled={busy}><Play className="w-4 h-4 mr-1" />Rulează acum</Button>}
          <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)} disabled={busy}><Lock className="w-4 h-4 mr-1" />Închide report {OLD_CARRY_YEAR}</Button>
          {pastDeadline && <Badge variant="destructive">Termenul orientativ pentru reportul {OLD_CARRY_YEAR} a trecut</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{opened ? 'Solduri' : 'Previzualizare'} {NEW_YEAR}</CardTitle>
          <Input placeholder="Caută angajat..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs mt-2" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-b border-border">
                <th className="text-left py-2">Angajat</th>
                <th className="text-right">Report {OLD_CARRY_YEAR}</th>
                <th className="text-right">Report {NEW_YEAR - 1}</th>
                <th className="text-right">Sold {NEW_YEAR}</th>
                <th className="text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const prev = frozen.has(r.id) ? frozen.get(r.id)! : opened ? null : prevYearLeftover(r.total, r.bonusPrev, r.used);
                const ent = r.entitlement ?? STANDARD_DAYS;
                return (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.department || '—'}</div>
                    </td>
                    <td className="text-right">{r.carryOld}</td>
                    <td className="text-right">{prev ?? '—'}</td>
                    <td className="text-right">
                      {ent}{r.entitlement !== null && r.entitlement !== STANDARD_DAYS && <Badge variant="secondary" className="ml-1">excepție</Badge>}
                    </td>
                    <td className="text-right font-semibold">{prev !== null ? r.carryOld + prev + ent : '—'}</td>
                    <td className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEdit(r); setEditDays(String(ent)); setEditReason(r.reason === 'Sold standard' ? '' : r.reason || ''); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sold {NEW_YEAR} – {edit?.name}</DialogTitle></DialogHeader>
          <Input type="number" min={0} value={editDays} onChange={(e) => setEditDays(e.target.value)} />
          <Textarea placeholder="Motiv (obligatoriu)" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
          <DialogFooter><Button onClick={saveEdit}>Salvează</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Închide reportul {OLD_CARRY_YEAR}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Zilele rămase din {OLD_CARRY_YEAR} nu vor mai putea fi folosite. Acțiunea se înregistrează în istoric.</p>
          <Textarea placeholder="Motiv (obligatoriu)" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
          <DialogFooter>
            <Button variant="destructive" disabled={closeReason.trim().length < 5} onClick={() => setReauth('close')}>Închide report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={yearOpen} onOpenChange={setYearOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Închide anul {NEW_YEAR - 1}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Zilele rămase din {NEW_YEAR - 1} se trec ca report în {NEW_YEAR} și se blochează la valoarea de acum. Reportul din {OLD_CARRY_YEAR} se păstrează.
            Soldul de {STANDARD_DAYS} de zile intră pe 1 ianuarie. Concediile din {NEW_YEAR - 1} aprobate după închidere nu vor mai scădea din report.
          </p>
          <Textarea placeholder="Motiv (obligatoriu)" value={yearReason} onChange={(e) => setYearReason(e.target.value)} />
          <DialogFooter>
            <Button disabled={yearReason.trim().length < 5 || busy} onClick={() => setReauth('closeYear')}>Închide anul</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReauthDialog
        open={!!reauth}
        onOpenChange={(o) => !o && setReauth(null)}
        onSuccess={() => { const a = reauth; setReauth(null); if (a === 'run') runNow(); else if (a === 'closeYear') closeYear(); else closeOld(); }}
        title="Confirmați cu parola"
      />
    </div>
  );
}
