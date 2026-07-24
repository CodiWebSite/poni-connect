import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];

interface ReportRow {
  id: string;
  payslip_id: string;
  reported_by: string;
  reason: string;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  payslip?: { month: number; year: number; name_detected: string | null; employee_epd_id: string | null } | null;
  reporter_name?: string | null;
}

export default function PayslipIssueReports() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [resolving, setResolving] = useState<ReportRow | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('payslip_issue_reports')
      .select('id, payslip_id, reported_by, reason, status, resolution_notes, resolved_at, created_at, payslips(month, year, name_detected, employee_epd_id)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) { toast.error('Nu am putut încărca sesizările'); setLoading(false); return; }

    const reporterIds = Array.from(new Set((data ?? []).map((r: any) => r.reported_by)));
    let names: Record<string, string> = {};
    if (reporterIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', reporterIds);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
    }
    setRows((data ?? []).map((r: any) => ({
      ...r,
      payslip: r.payslips,
      reporter_name: names[r.reported_by] ?? '—',
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const markResolved = async () => {
    if (!resolving) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('payslip_issue_reports')
      .update({
        status: 'resolved',
        resolution_notes: notes || null,
        resolved_by: userData?.user?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', resolving.id);
    setSaving(false);
    if (error) { toast.error('Eroare la salvare'); return; }
    toast.success('Sesizare marcată ca rezolvată');
    setResolving(null);
    setNotes('');
    load();
  };

  const openCount = rows.filter(r => r.status === 'open').length;

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Sesizări fluturași incorecți
              {openCount > 0 && <Badge variant="destructive" className="ml-1">{openCount} deschise</Badge>}
            </CardTitle>
            <CardDescription>
              Angajații pot semnaliza aici un fluturaș care nu le corespunde. După corectare, marcați rezolvată.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {(['open','resolved','all'] as const).map(f => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
                {f === 'open' ? 'Deschise' : f === 'resolved' ? 'Rezolvate' : 'Toate'}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Nicio sesizare {filter === 'open' ? 'deschisă' : filter === 'resolved' ? 'rezolvată' : ''}.</div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {r.payslip ? `${MONTHS[r.payslip.month - 1]} ${r.payslip.year}` : 'Fluturaș necunoscut'}
                      {r.payslip?.name_detected && <span className="text-muted-foreground font-normal"> · {r.payslip.name_detected}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Raportat de <strong>{r.reporter_name}</strong> · {format(new Date(r.created_at), 'd MMM yyyy HH:mm', { locale: ro })}
                    </div>
                  </div>
                  <Badge variant={r.status === 'open' ? 'destructive' : 'secondary'} className="shrink-0">
                    {r.status === 'open' ? 'Deschisă' : 'Rezolvată'}
                  </Badge>
                </div>
                <div className="text-sm whitespace-pre-wrap p-2 rounded bg-muted/50">{r.reason}</div>
                {r.resolution_notes && (
                  <div className="text-xs p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <strong>Rezoluție:</strong> {r.resolution_notes}
                  </div>
                )}
                {r.status === 'open' && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => { setResolving(r); setNotes(''); }}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Marchează rezolvată
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!resolving} onOpenChange={(o) => { if (!o) { setResolving(null); setNotes(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marchează sesizare ca rezolvată</DialogTitle>
            <DialogDescription>
              După înlocuirea fluturașului corect prin re-încărcare lot, adăugați o notă scurtă pentru istoric.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Am reîncărcat lotul cu PDF-ul corect și am redistribuit."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>Anulează</Button>
            <Button onClick={markResolved} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
