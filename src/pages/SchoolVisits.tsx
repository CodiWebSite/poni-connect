import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolVisitsAccess } from '@/hooks/useSchoolVisitsAccess';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { School, Users, Clock, CalendarClock, Plus, Download, Loader2, AlertTriangle, Ban, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveVisitStatus, STATUS_LABEL, monthLabel, VisitStatus } from '@/utils/schoolVisits';
import { cn } from '@/lib/utils';

interface Visit {
  id: string; visit_date: string; visit_time: string | null; institution: string; request_no: string | null;
  approval_no: string | null; participants: number | null; class_level: string | null; teachers: string | null;
  status: string; cancelled_at: string | null;
}

const STATUS_CLS: Record<VisitStatus, string> = {
  aprobata: 'bg-success/15 text-success border-success/30',
  semnare: 'bg-warning/15 text-warning border-warning/30',
  intentie: 'bg-info/15 text-info border-info/30',
  anulata: 'bg-destructive/10 text-destructive border-destructive/30 line-through',
  nou: 'bg-muted text-muted-foreground',
};

const fmtDate = (d: string) => d.split('-').reverse().join('.');

const Cell = ({ value, onSave, type = 'text', multiline }: { value: string; onSave: (v: string) => void; type?: string; multiline?: boolean }) => {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v !== value) onSave(v); };
  const cls = 'w-full bg-transparent rounded px-1.5 py-1 text-sm hover:bg-muted/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none';
  return multiline
    ? <textarea rows={2} className={cls} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
    : <input type={type} className={cls} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
};

const SchoolVisits = () => {
  const { user } = useAuth();
  const { canAccess, loading: accessLoading } = useSchoolVisitsAccess();
  const { toast } = useToast();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const load = async () => {
    const { data } = await supabase.from('school_visits').select('*').order('visit_date').order('visit_time');
    setVisits((data || []) as Visit[]);
    setLoading(false);
  };
  useEffect(() => { if (canAccess) load(); }, [canAccess]);

  const update = async (id: string, patch: Partial<Visit>) => {
    setVisits((vs) => vs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('school_visits').update({ ...patch, updated_by: user?.id }).eq('id', id);
    if (error) { toast({ title: 'Nu s-a salvat', description: error.message, variant: 'destructive' }); load(); return; }
    supabase.rpc('log_audit_event', { _user_id: user!.id, _action: 'school_visit_update', _entity_type: 'school_visits', _entity_id: id, _details: patch as any });
    toast({ title: 'Salvat' });
  };

  const add = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from('school_visits').insert({ visit_date: today, visit_time: '10:00', institution: '', created_by: user?.id }).select().single();
    if (error) return toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    supabase.rpc('log_audit_event', { _user_id: user!.id, _action: 'school_visit_create', _entity_type: 'school_visits', _entity_id: data.id, _details: {} });
    setVisits((v) => [...v, data as Visit]);
    setView('table');
  };

  const filtered = useMemo(() => visits.filter((v) =>
    (!q || `${v.institution} ${v.teachers || ''}`.toLowerCase().includes(q.toLowerCase())) &&
    (statusF === 'all' || resolveVisitStatus(v) === statusF)), [visits, q, statusF]);

  const groups = useMemo(() => {
    const m = new Map<string, Visit[]>();
    filtered.forEach((v) => { const k = monthLabel(v.visit_date); m.set(k, [...(m.get(k) || []), v]); });
    return [...m.entries()];
  }, [filtered]);

  const busyDays = useMemo(() => {
    const c: Record<string, number> = {};
    visits.filter((v) => !v.cancelled_at).forEach((v) => (c[v.visit_date] = (c[v.visit_date] || 0) + 1));
    return c;
  }, [visits]);

  const today = new Date().toISOString().slice(0, 10);
  const active = visits.filter((v) => !v.cancelled_at);
  const thisMonth = active.filter((v) => v.visit_date.slice(0, 7) === today.slice(0, 7));
  const next = active.find((v) => v.visit_date >= today);
  const daysTo = next ? Math.round((new Date(next.visit_date).getTime() - new Date(today).getTime()) / 864e5) : null;
  const pendingCount = active.filter((v) => ['semnare', 'intentie', 'nou'].includes(resolveVisitStatus(v))).length;

  const exportXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.columns = [{ width: 13 }, { width: 8 }, { width: 42 }, { width: 18 }, { width: 22 }, { width: 12 }, { width: 18 }, { width: 45 }];
    const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } as any;
    ws.mergeCells('A1:H1');
    ws.getCell('A1').value = 'PROGRAMARI VIZITE SCOLI LA ICMPP IASI';
    ws.getCell('A1').font = { name: 'Arial', bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    const h = ws.addRow(['Data', 'ora', 'UNITATEA DE INVATAMANT \n(SCOALA/ UNIVERSITATEA)', 'Nr solicitare\n Unitate de invatamant', 'Aprobare\nNr. Inregistrare ICMPP', 'numar (elevi/ studenti)', 'clasa', 'cadre didactice']);
    h.eachCell((c) => { c.font = { name: 'Arial', bold: true, size: 10 }; c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }; c.border = border; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEF7' } }; });
    h.height = 42;
    const all = new Map<string, Visit[]>();
    visits.filter((v) => !v.cancelled_at).forEach((v) => { const k = monthLabel(v.visit_date); all.set(k, [...(all.get(k) || []), v]); });
    all.forEach((rows, label) => {
      const r = ws.addRow([label]); ws.mergeCells(`A${r.number}:H${r.number}`);
      r.getCell(1).font = { name: 'Arial', bold: true, size: 11 }; r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      rows.forEach((v) => {
        const row = ws.addRow([fmtDate(v.visit_date), v.visit_time, v.institution, v.request_no, v.approval_no, v.participants, v.class_level, v.teachers]);
        row.eachCell({ includeEmpty: true }, (c) => { c.font = { name: 'Arial', size: 10 }; c.alignment = { wrapText: true, vertical: 'middle' }; c.border = border; });
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = 'programari_vizite_ICMPP.xlsx'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  if (accessLoading) return null;
  if (!canAccess) return <Navigate to="/" replace />;

  const Stat = ({ icon: I, label, value, sub }: any) => (
    <Card className="border-primary/10"><CardContent className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><I className="w-5 h-5" /></div>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold leading-tight truncate">{value}</p>{sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}</div>
    </CardContent></Card>
  );

  // calendar
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <MainLayout title="Programări vizite ICMPP" description="Vizite ale școlilor și universităților la institut">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={School} label="Vizite luna aceasta" value={thisMonth.length} />
        <Stat icon={Users} label="Elevi / studenți (luna)" value={thisMonth.reduce((s, v) => s + (v.participants || 0), 0)} />
        <Stat icon={Clock} label="Așteaptă aprobare" value={pendingCount} />
        <Stat icon={CalendarClock} label="Următoarea vizită" value={next ? (daysTo === 0 ? 'Azi' : `peste ${daysTo} zile`) : '—'} sub={next ? `${fmtDate(next.visit_date)} · ${next.institution}` : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="table">Tabel pe luni</TabsTrigger><TabsTrigger value="calendar">Calendar</TabsTrigger></TabsList></Tabs>
        <Input className="max-w-xs" placeholder="Caută școala sau profesorul…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Toate stările</SelectItem>{Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportXlsx}><Download className="w-4 h-4 mr-1" />Export Excel</Button>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Adaugă vizită</Button>
        </div>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : view === 'table' ? (
        <div className="space-y-5">
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Nicio vizită.</p>}
          {groups.map(([label, rows]) => (
            <Card key={label} className="overflow-hidden">
              <div className="px-4 py-2.5 bg-primary/5 border-b font-semibold text-sm tracking-wide text-primary">{label}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead className="text-xs text-muted-foreground bg-muted/40">
                    <tr>{['Data', 'Ora', 'Unitatea de învățământ', 'Nr. solicitare', 'Aprobare / Nr. înreg. ICMPP', 'Nr. elevi', 'Clasa', 'Cadre didactice', 'Stare', ''].map((h) => <th key={h} className="text-left font-medium px-2 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => {
                      const st = resolveVisitStatus(v);
                      return (
                        <tr key={v.id} className={cn('border-t align-top', v.cancelled_at && 'opacity-50')}>
                          <td className="w-36 p-1"><Cell type="date" value={v.visit_date} onSave={(x) => x && update(v.id, { visit_date: x })} />
                            {busyDays[v.visit_date] > 1 && !v.cancelled_at && <span className="flex items-center gap-1 text-[11px] text-warning px-1.5"><AlertTriangle className="w-3 h-3" />{busyDays[v.visit_date]} grupuri în ziua asta</span>}</td>
                          <td className="w-20 p-1"><Cell value={v.visit_time || ''} onSave={(x) => update(v.id, { visit_time: x || null })} /></td>
                          <td className="p-1 min-w-[220px]"><Cell multiline value={v.institution} onSave={(x) => update(v.id, { institution: x })} /></td>
                          <td className="w-36 p-1"><Cell value={v.request_no || ''} onSave={(x) => update(v.id, { request_no: x || null })} /></td>
                          <td className="w-40 p-1"><Cell value={v.approval_no || ''} onSave={(x) => update(v.id, { approval_no: x || null })} /></td>
                          <td className="w-20 p-1"><Cell type="number" value={v.participants?.toString() || ''} onSave={(x) => update(v.id, { participants: x ? +x : null })} /></td>
                          <td className="w-32 p-1"><Cell value={v.class_level || ''} onSave={(x) => update(v.id, { class_level: x || null })} /></td>
                          <td className="p-1 min-w-[220px]"><Cell multiline value={v.teachers || ''} onSave={(x) => update(v.id, { teachers: x || null })} /></td>
                          <td className="w-40 p-1">
                            <Select value={v.cancelled_at ? 'anulata' : v.status} disabled={!!v.cancelled_at} onValueChange={(x) => update(v.id, { status: x })}>
                              <SelectTrigger className={cn('h-8 text-xs border', STATUS_CLS[st])}><span>{STATUS_LABEL[st]}</span></SelectTrigger>
                              <SelectContent><SelectItem value="auto">Automat (după aprobare)</SelectItem>{(['aprobata', 'semnare', 'intentie', 'nou'] as VisitStatus[]).map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="w-10 p-1">
                            {v.cancelled_at
                              ? <Button size="icon" variant="ghost" title="Reactivează" onClick={() => update(v.id, { cancelled_at: null })}><RotateCcw className="w-4 h-4" /></Button>
                              : <Button size="icon" variant="ghost" title="Anulează vizita" onClick={() => confirm('Marchezi vizita ca anulată?') && update(v.id, { cancelled_at: new Date().toISOString() })}><Ban className="w-4 h-4 text-destructive" /></Button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Button size="icon" variant="ghost" onClick={() => setCalMonth(new Date(y, m - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <p className="font-semibold">{monthLabel(`${y}-${String(m + 1).padStart(2, '0')}-01`).replace('LUNA ', '')}</p>
            <Button size="icon" variant="ghost" onClick={() => setCalMonth(new Date(y, m + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map((d) => <div key={d} className="text-center text-muted-foreground py-1">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const dv = filtered.filter((v) => v.visit_date === iso);
              return (
                <div key={i} className={cn('min-h-24 rounded-lg border p-1', iso === today && 'border-primary ring-1 ring-primary/40')}>
                  <p className="text-muted-foreground mb-1">{d}</p>
                  {dv.map((v) => <div key={v.id} className={cn('rounded px-1 py-0.5 mb-1 border truncate', STATUS_CLS[resolveVisitStatus(v)])} title={`${v.visit_time || ''} ${v.institution} · ${v.participants || '?'} pers.`}>{v.visit_time} {v.institution}</div>)}
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      )}
    </MainLayout>
  );
};

export default SchoolVisits;
