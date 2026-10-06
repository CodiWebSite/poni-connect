import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useDecisionRegistryAccess } from '@/hooks/useDecisionRegistryAccess';
import ReauthDialog from '@/components/shared/ReauthDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Download, Plus, Pencil, Ban, Upload, Loader2, Search } from 'lucide-react';

export const MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const SHEETS = ['ian', 'feb', 'mar', 'aprilie', 'mai', 'iunie', 'iulie', 'aug', 'sept', 'oct', 'nov.', 'dec'];

interface Decision {
  id: string; year: number; number: number; month: number; title: string;
  decision_date: string | null; funding_source: string | null; author_initials: string | null;
  status: string; cancel_reason: string | null; edit_reason: string | null;
}

const fmtDate = (d: string | null) => (d ? d.split('-').reverse().join('.') : '');

async function buildWorkbook(rows: Decision[], year: number, onlyMonth?: number) {
  const wb = new ExcelJS.Workbook();
  const months = onlyMonth ? [onlyMonth] : MONTHS.map((_, i) => i + 1);
  for (const m of months) {
    const ws = wb.addWorksheet(SHEETS[m - 1]);
    ws.columns = [{ width: 1.11 }, { width: 6.44 }, { width: 99.33 }, { width: 15.44 }, { width: 41 }, { width: 8.43 }];
    const f = { name: 'Times New Roman', size: 12 };
    ws.getCell('B1').value = 'ACADEMIA ROMÂNĂ';
    ws.getCell('B2').value = 'Institutul de Chimie Macromoleculară "Petru Poni" Iași';
    ws.getCell('B3').value = 'Serviciul Resurse Umane Salarizare - SRUS';
    ws.getCell('B1').font = ws.getCell('B2').font = { ...f, bold: true };
    ws.getCell('B3').font = f;
    ws.getCell('B3').alignment = { vertical: 'middle' };
    ws.mergeCells('A5:E5');
    ws.getCell('A5').value = `OPIS DECIZII ${year}`;
    ws.getCell('A5').font = { ...f, bold: true, size: 18 };
    ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('D7').value = 'Luna:';
    ws.getCell('D7').font = f;
    ws.getCell('D7').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('E7').value = MONTHS[m - 1];
    ws.getCell('E7').font = { name: 'Calibri', size: 12 };
    ws.getCell('E7').alignment = { horizontal: 'center', vertical: 'middle' };
    const thin = { style: 'thin' } as const;
    const med = { style: 'medium' } as const;
    ws.getCell('E7').border = { top: thin, left: thin, bottom: thin, right: thin };
    const head = ws.getRow(9);
    ['', 'NR.', 'DENUMIRE ACT', 'DATA', 'OBS.', ''].forEach((v, i) => (head.getCell(i + 1).value = v));
    head.getCell(2).font = { ...f, bold: true, size: 14 };
    head.getCell(3).font = { ...f, bold: true };
    head.getCell(4).font = { ...f, bold: true, size: 14 };
    head.getCell(5).font = { ...f, bold: true, size: 14 };
    head.getCell(2).border = { top: med, left: med, bottom: med, right: thin };
    head.getCell(3).border = { top: med, left: thin, bottom: med, right: thin };
    head.getCell(4).border = { top: med, left: thin, bottom: med, right: thin };
    head.getCell(5).border = { top: med, left: thin, bottom: med, right: med };
    for (let c = 2; c <= 5; c++) head.getCell(c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    let r = 10;
    rows.filter((d) => d.month === m).sort((a, b) => a.number - b.number).forEach((d) => {
      const row = ws.getRow(r++);
      row.getCell(2).value = d.number;
      row.getCell(3).value = d.status === 'anulata' ? `${d.title} (ANULATĂ)` : d.title;
      if (d.decision_date) { row.getCell(4).value = new Date(d.decision_date + 'T00:00:00Z'); row.getCell(4).numFmt = 'dd.mm.yyyy'; }
      row.getCell(5).value = d.funding_source ?? '';
      row.getCell(6).value = d.author_initials ?? '';
      for (let c = 2; c <= 5; c++) { row.getCell(c).border = border; row.getCell(c).font = f; }
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      row.getCell(3).alignment = { horizontal: 'left' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(6).font = { name: 'Calibri', size: 11 };
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = onlyMonth ? `RegistruDecizii${year}_${MONTHS[onlyMonth - 1]}.xlsx` : `RegistruDecizii${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

const cellVal = (v: any): any => (v && typeof v === 'object' && 'result' in v ? v.result : v && typeof v === 'object' && 'richText' in v ? v.richText.map((t: any) => t.text).join('') : v);

export default function DecisionRegistry() {
  const { user } = useAuth();
  const { isRealSuperAdmin } = useUserRole();
  const { canAccess, loading: accessLoading } = useDecisionRegistryAccess();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [rows, setRows] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [funding, setFunding] = useState('all');
  const [author, setAuthor] = useState('all');
  const [editing, setEditing] = useState<Partial<Decision> | null>(null);
  const [reason, setReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Decision | null>(null);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const all: Decision[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('decision_registry').select('*').eq('year', year).order('number').range(from, from + 999);
      if (error) { toast.error('Registrul nu a putut fi încărcat'); break; }
      all.push(...((data || []) as Decision[]));
      if (!data || data.length < 1000) break;
    }
    setRows(all);
    setLoading(false);
  };
  useEffect(() => { if (canAccess) load(); }, [canAccess, year]);

  const fundings = useMemo(() => [...new Set(rows.map((r) => r.funding_source).filter(Boolean))].sort() as string[], [rows]);
  const authors = useMemo(() => [...new Set(rows.map((r) => r.author_initials).filter(Boolean))].sort() as string[], [rows]);
  const visible = rows.filter((r) =>
    (search ? true : String(r.month) === month) &&
    (!search || `${r.number} ${r.title}`.toLowerCase().includes(search.toLowerCase())) &&
    (funding === 'all' || r.funding_source === funding) &&
    (author === 'all' || r.author_initials === author));
  const countFor = (m: number) => rows.filter((r) => r.month === m).length;

  if (accessLoading) return <MainLayout title="Registru Decizii"><Loader2 className="w-6 h-6 animate-spin" /></MainLayout>;
  if (!canAccess) return <Navigate to="/" replace />;

  const withReauth = (fn: () => void) => setPending(() => fn);

  const save = async () => {
    if (!editing?.title?.trim()) return toast.error('Completează denumirea actului');
    if (editing.id && reason.trim().length < 5) return toast.error('Motivul modificării este obligatoriu (min. 5 caractere)');
    setSaving(true);
    const payload = {
      title: editing.title.trim(),
      decision_date: editing.decision_date || null,
      funding_source: editing.funding_source?.trim() || null,
      author_initials: editing.author_initials?.trim() || null,
      month: editing.decision_date ? Number(editing.decision_date.slice(5, 7)) : (editing.month || Number(month)),
    };
    const res = editing.id
      ? await supabase.from('decision_registry').update({ ...payload, edit_reason: reason.trim() }).eq('id', editing.id)
      : await supabase.from('decision_registry').insert({ ...payload, year, number: 0, created_by: user?.id }).select('number').single();
    setSaving(false);
    if (res.error) return toast.error('Salvarea a eșuat: ' + res.error.message);
    await supabase.rpc('log_audit_event', { _user_id: user!.id, _action: editing.id ? 'decision_edit' : 'decision_create', _entity_type: 'decision_registry', _entity_id: editing.id ?? '', _details: { ...payload, reason } as any });
    toast.success(editing.id ? 'Decizie actualizată' : `Decizia nr. ${(res.data as any)?.number} a fost înregistrată`);
    setEditing(null); setReason(''); load();
  };

  const doCancel = async () => {
    if (!cancelTarget || reason.trim().length < 5) return toast.error('Motivul anulării este obligatoriu');
    const { error } = await supabase.from('decision_registry').update({ status: 'anulata', cancel_reason: reason.trim() }).eq('id', cancelTarget.id);
    if (error) return toast.error('Anularea a eșuat');
    await supabase.rpc('log_audit_event', { _user_id: user!.id, _action: 'decision_cancel', _entity_type: 'decision_registry', _entity_id: cancelTarget.id, _details: { number: cancelTarget.number, reason } as any });
    toast.success('Decizie anulată'); setCancelTarget(null); setReason(''); load();
  };

  const importXlsx = async (file: File) => {
    setSaving(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const out: any[] = [];
      wb.worksheets.forEach((ws, idx) => {
        if (idx > 11) return;
        ws.eachRow((row, rn) => {
          if (rn < 10) return;
          const nr = cellVal(row.getCell(2).value);
          const title = cellVal(row.getCell(3).value);
          if (typeof nr !== 'number' || !title || !String(title).trim()) return;
          const d = cellVal(row.getCell(4).value);
          const date = d instanceof Date ? d.toISOString().slice(0, 10) : null;
          const s = (v: any) => { const x = cellVal(v); return x == null || String(x).trim() === '' ? null : String(x).trim(); };
          out.push({ year, number: nr, month: idx + 1, title: String(title).trim(), decision_date: date, funding_source: s(row.getCell(5).value), author_initials: s(row.getCell(6).value), created_by: user?.id });
        });
      });
      for (let i = 0; i < out.length; i += 200) {
        const { error } = await supabase.from('decision_registry').upsert(out.slice(i, i + 200), { onConflict: 'year,number', ignoreDuplicates: true });
        if (error) throw error;
      }
      toast.success(`Import finalizat: ${out.length} decizii citite (cele existente au fost păstrate)`);
      load();
    } catch (e: any) {
      toast.error('Importul a eșuat: ' + (e?.message ?? ''));
    } finally { setSaving(false); }
  };

  return (
    <MainLayout title="Registru Decizii" description="Opis decizii — acces restricționat">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Caută în tot anul (nume, denumire, nr.)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={funding} onValueChange={setFunding}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Obs." /></SelectTrigger>
          <SelectContent><SelectItem value="all">Toate sursele</SelectItem>{fundings.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={author} onValueChange={setAuthor}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Toți întocmitorii</SelectItem>{authors.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => { setReason(''); setEditing({ decision_date: new Date().toISOString().slice(0, 10) }); }}><Plus className="w-4 h-4 mr-1" />Decizie nouă</Button>
        <Button variant="outline" onClick={() => withReauth(() => buildWorkbook(rows, year, Number(month)))}><Download className="w-4 h-4 mr-1" />Export lună</Button>
        <Button variant="outline" onClick={() => withReauth(() => buildWorkbook(rows, year))}><Download className="w-4 h-4 mr-1" />Export an (XLSX)</Button>
        {isRealSuperAdmin && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = ''; }} />
            <Button variant="secondary" disabled={saving} onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" />Import XLSX</Button>
          </>
        )}
      </div>

      {!search && (
        <Tabs value={month} onValueChange={setMonth} className="mb-3">
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            {MONTHS.map((m, i) => (
              <TabsTrigger key={m} value={String(i + 1)} className="text-xs">{m.slice(0, 3)} <span className="ml-1 text-muted-foreground">{countFor(i + 1)}</span></TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 w-16">Nr.</th><th className="p-2">Denumire act</th><th className="p-2 w-28">Data</th>
              <th className="p-2 w-44">Obs.</th><th className="p-2 w-24">Întocmit</th><th className="p-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              : visible.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nicio decizie</td></tr>
              : visible.map((d) => (
                <tr key={d.id} className={`border-t border-border ${d.status === 'anulata' ? 'opacity-50' : ''}`}>
                  <td className="p-2 font-semibold tabular-nums">{d.number}</td>
                  <td className="p-2">
                    {d.title}
                    {d.status === 'anulata' && <Badge variant="destructive" className="ml-2">Anulată</Badge>}
                    {d.cancel_reason && <div className="text-xs text-muted-foreground">Motiv anulare: {d.cancel_reason}</div>}
                    {search && <span className="ml-2 text-xs text-muted-foreground">({MONTHS[d.month - 1]})</span>}
                  </td>
                  <td className="p-2 tabular-nums">{fmtDate(d.decision_date)}</td>
                  <td className="p-2">{d.funding_source}</td>
                  <td className="p-2">{d.author_initials}</td>
                  <td className="p-2 whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setReason(''); setEditing(d); }}><Pencil className="w-4 h-4" /></Button>
                    {d.status !== 'anulata' && <Button size="icon" variant="ghost" onClick={() => { setReason(''); setCancelTarget(d); }}><Ban className="w-4 h-4" /></Button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? `Editare decizia nr. ${editing.number}` : 'Decizie nouă (numărul se alocă automat)'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Denumire act</Label><Textarea value={editing?.title ?? ''} onChange={(e) => setEditing({ ...editing!, title: e.target.value })} placeholder="NUME PRENUME, tip decizie, perioadă" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Data</Label><Input type="date" value={editing?.decision_date ?? ''} onChange={(e) => setEditing({ ...editing!, decision_date: e.target.value })} /></div>
              <div><Label>Obs.</Label><Input value={editing?.funding_source ?? ''} onChange={(e) => setEditing({ ...editing!, funding_source: e.target.value })} placeholder="Buget" /></div>
              <div><Label>Întocmit</Label><Input value={editing?.author_initials ?? ''} onChange={(e) => setEditing({ ...editing!, author_initials: e.target.value })} placeholder="LN" /></div>
            </div>
            {editing?.id && <div><Label>Motivul modificării *</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
          </div>
          <DialogFooter><Button onClick={() => (editing?.id ? withReauth(save) : save())} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salvează</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anulare decizia nr. {cancelTarget?.number}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Decizia rămâne în registru marcată „Anulată", ca numerotarea să nu se strice.</p>
          <div><Label>Motivul anulării *</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter><Button variant="destructive" onClick={() => withReauth(doCancel)}>Anulează decizia</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ReauthDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} onSuccess={() => { const fn = pending; setPending(null); fn?.(); }} />
    </MainLayout>
  );
}
