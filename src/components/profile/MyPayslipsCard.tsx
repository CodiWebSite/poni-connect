import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Banknote, CheckCircle2, Download, Info, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const MONTH_NAMES_RO = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

interface PayslipRow {
  id: string;
  month: number;
  year: number;
  distributed_at: string | null;
  download_count: number;
  first_downloaded_at: string | null;
}

export default function MyPayslipsCard() {
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [reporting, setReporting] = useState<PayslipRow | null>(null);
  const [reason, setReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const loadReports = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('payslip_issue_reports')
      .select('payslip_id')
      .in('payslip_id', ids)
      .eq('status', 'open');
    setReportedIds(new Set((data ?? []).map((r: any) => r.payslip_id)));
  };

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) { setLoading(false); return; }

      const { data: pilotFlag } = await supabase.rpc('is_payslip_pilot_user', { _user_id: uid });
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', uid);
      const roleSet = new Set((roles ?? []).map((r: any) => r.role));
      const roleBypass = roleSet.has('super_admin') || roleSet.has('salarizare');
      const isPilot = pilotFlag === true || roleBypass;

      const { data: recs } = await supabase
        .from('employee_records')
        .select('id')
        .eq('user_id', uid);
      const recIds = (recs ?? []).map((r: any) => r.id);

      let epdIds: string[] = [];
      if (recIds.length > 0) {
        const { data: epds } = await supabase
          .from('employee_personal_data')
          .select('id')
          .in('employee_record_id', recIds);
        epdIds = (epds ?? []).map((e: any) => e.id);
      }

      let payslipRows: PayslipRow[] = [];
      if (epdIds.length > 0) {
        const { data } = await supabase
          .from('payslips')
          .select('id, month, year, distributed_at, download_count, first_downloaded_at')
          .in('employee_epd_id', epdIds)
          .eq('match_status', 'distributed')
          .order('year', { ascending: false })
          .order('month', { ascending: false });
        payslipRows = (data ?? []) as PayslipRow[];
      }

      setRows(payslipRows);
      setHasAccess(isPilot || payslipRows.length > 0);
      setLoading(false);
    })();
  }, []);

  if (!loading && !hasAccess) return null;

  const download = async (id: string) => {
    setDownloading(id);
    try {
      const { data, error } = await supabase.functions.invoke('payslip-download', {
        body: { payslip_id: id },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Nu am putut genera link-ul');
      // Open in a new tab; browser will prompt for password when opening the PDF
      window.open(data.url, '_blank', 'noopener,noreferrer');
      toast.success('Fluturaș deschis. Parola: ultimele 6 cifre din CNP.');
      // Refresh counts
      setRows(prev => prev.map(r => r.id === id ? { ...r, download_count: r.download_count + 1, first_downloaded_at: r.first_downloaded_at ?? new Date().toISOString() } : r));
    } catch (e) {
      toast.error((e as Error).message || 'Eroare la descărcare');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card className="animate-fade-in border-accent/30" style={{ animationDelay: '180ms' }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="w-4 h-4 text-primary" />
              Fluturașii mei
            </CardTitle>
            <CardDescription className="mt-1">
              Istoric lună-cu-lună al fluturașilor de salariu, disponibili în format PDF criptat.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px]">Fază pilot</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert className="border-primary/30 bg-primary/5">
          <KeyRound className="w-4 h-4" />
          <AlertDescription className="text-xs">
            Fișierul PDF este protejat cu parolă. <strong>Parola = ultimele 6 cifre din CNP-ul dvs.</strong> Introduceți-o când vă deschide cititorul PDF fișierul.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center flex flex-col items-center gap-2">
            <Info className="w-5 h-5 opacity-60" />
            <span>Nu aveți încă niciun fluturaș încărcat. Vor apărea aici după ce salarizarea îi distribuie lunar.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{MONTH_NAMES_RO[r.month - 1]} {r.year}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.distributed_at ? `Distribuit ${format(new Date(r.distributed_at), 'd MMM yyyy', { locale: ro })}` : 'În pregătire'}
                    {r.download_count > 0 && ` • Descărcat de ${r.download_count} ori`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={downloading === r.id || !r.distributed_at}
                  onClick={() => download(r.id)}
                >
                  {downloading === r.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <><Download className="w-3.5 h-3.5 mr-1.5" /> Descarcă</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
