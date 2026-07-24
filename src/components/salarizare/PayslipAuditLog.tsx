import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';

interface AuditRow {
  id: string;
  user_id: string | null;
  payslip_id: string | null;
  batch_id: string | null;
  action: string;
  ip: string | null;
  user_agent: string | null;
  details: any;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; className: string }> = {
  download: { label: 'Descărcare', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
  admin_view: { label: 'Vizualizare admin', className: 'bg-slate-500/15 text-slate-700 border-slate-500/30' },
  batch_uploaded: { label: 'Lot încărcat', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  batch_distributed: { label: 'Lot distribuit', className: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30' },
  batch_deleted: { label: 'Lot șters', className: 'bg-red-500/15 text-red-700 border-red-500/30' },
  reprocess: { label: 'Re-procesare', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  restage_plain: { label: 'Restage preview', className: 'bg-purple-500/15 text-purple-700 border-purple-500/30' },
  manual_match: { label: 'Asociere manuală', className: 'bg-teal-500/15 text-teal-700 border-teal-500/30' },
};

export default function PayslipAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payslip_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      setRows((data ?? []) as AuditRow[]);

      const uids = Array.from(new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)));
      if (uids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uids as string[]);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name; });
        setUsers(map);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (r.user_id ? users[r.user_id] : '') || '';
        if (!name.toLowerCase().includes(q) && !r.action.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, users, actionFilter, search]);

  const exportCsv = () => {
    const header = ['Data', 'Acțiune', 'Utilizator', 'Payslip', 'Batch', 'IP', 'Detalii'];
    const lines = [header.join(',')];
    filtered.forEach(r => {
      const line = [
        format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
        r.action,
        `"${(r.user_id ? users[r.user_id] : r.user_id) ?? ''}"`,
        r.payslip_id ?? '',
        r.batch_id ?? '',
        r.ip ?? '',
        `"${JSON.stringify(r.details ?? {}).replace(/"/g, '""')}"`,
      ].join(',');
      lines.push(line);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-fluturasi-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueActions = useMemo(() => {
    const set = new Set(rows.map(r => r.action));
    return Array.from(set);
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> Audit fluturași (super-admin)
        </CardTitle>
        <CardDescription>
          Jurnal complet: încărcări, previzualizări, distribuții, descărcări, re-procesări.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Caută după utilizator sau acțiune…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate acțiunile</SelectItem>
              {uniqueActions.map(a => (
                <SelectItem key={a} value={a}>{ACTION_META[a]?.label ?? a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <div className="text-xs text-muted-foreground ml-auto">
            {filtered.length} intrări (max 1000)
          </div>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Acțiune</th>
                <th className="p-2 text-left">Utilizator</th>
                <th className="p-2 text-left">IP</th>
                <th className="p-2 text-left">Detalii</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nu există intrări.
                </td></tr>
              )}
              {!loading && filtered.map(r => {
                const meta = ACTION_META[r.action] ?? { label: r.action, className: 'bg-muted text-foreground border-border' };
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap tabular-nums">
                      {format(new Date(r.created_at), 'd MMM yyyy HH:mm:ss', { locale: ro })}
                    </td>
                    <td className="p-2">
                      <Badge className={`${meta.className} border text-[11px]`}>{meta.label}</Badge>
                    </td>
                    <td className="p-2">{r.user_id ? (users[r.user_id] ?? r.user_id.slice(0, 8)) : '—'}</td>
                    <td className="p-2 font-mono text-[11px]">{r.ip ?? '—'}</td>
                    <td className="p-2 max-w-md truncate" title={JSON.stringify(r.details ?? {})}>
                      {r.details && Object.keys(r.details).length
                        ? JSON.stringify(r.details)
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
