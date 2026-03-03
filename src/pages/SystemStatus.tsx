import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  Shield, Database, Activity, FileDown, Loader2, Plus, CheckCircle2,
  AlertTriangle, AlertCircle, Info, Clock, Trash2, RefreshCw, Settings2, Download
} from 'lucide-react';

// ==================== TYPES ====================

interface BackupLog {
  id: string;
  type: string;
  status: string;
  size_info: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

interface SystemIncident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
}

// ==================== BACKUP TAB ====================

function BackupTab({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'backup', status: 'success', size_info: '', notes: '' });

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('backup_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((data as BackupLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleAdd = async () => {
    setAdding(true);
    const { error } = await supabase.from('backup_logs').insert({
      type: form.type,
      status: form.status,
      size_info: form.size_info || null,
      notes: form.notes || null,
      performed_by: userId,
    } as any);
    if (error) {
      toast.error('Eroare la salvare');
    } else {
      toast.success('Înregistrare adăugată');
      setShowForm(false);
      setForm({ type: 'backup', status: 'success', size_info: '', notes: '' });
      fetchLogs();
    }
    setAdding(false);
  };

  const statusIcon = (s: string) => {
    if (s === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (s === 'failure') return <AlertCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      failure: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
    const labels: Record<string, string> = { success: 'Succes', failure: 'Eșuat', in_progress: 'În curs' };
    return <Badge className={colors[s] || 'bg-muted text-muted-foreground'}>{labels[s] || s}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5 text-primary" />Backup & Restore</CardTitle>
            <CardDescription>Jurnal backup-uri și teste de restaurare</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="w-4 h-4 mr-1" />Reîncarcă</Button>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" />Înregistrare</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>Nicio înregistrare de backup</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                {statusIcon(log.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {log.type === 'backup' ? 'Backup' : log.type === 'restore_test' ? 'Test Restaurare' : log.type}
                    </span>
                    {statusBadge(log.status)}
                    {log.size_info && <span className="text-xs text-muted-foreground">{log.size_info}</span>}
                  </div>
                  {log.notes && <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Înregistrare Backup/Restore</DialogTitle>
            <DialogDescription>Adaugă o intrare în jurnalul de backup</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tip</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backup">Backup</SelectItem>
                    <SelectItem value="restore_test">Test Restaurare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="success">Succes</SelectItem>
                    <SelectItem value="failure">Eșuat</SelectItem>
                    <SelectItem value="in_progress">În curs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Dimensiune/Info</Label>
              <Input placeholder="ex: 2.3 GB" value={form.size_info} onChange={e => setForm({ ...form, size_info: e.target.value })} />
            </div>
            <div>
              <Label>Observații</Label>
              <Textarea placeholder="Detalii..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Anulează</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Se salvează...</> : 'Salvează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ==================== STATUS / INCIDENTS TAB ====================

function StatusTab({ userId }: { userId: string }) {
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'info', status: 'investigating' });

  const fetchIncidents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('system_incidents')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);
    setIncidents((data as SystemIncident[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchIncidents(); }, []);

  const handleAdd = async () => {
    setAdding(true);
    const { error } = await supabase.from('system_incidents').insert({
      title: form.title,
      description: form.description || null,
      severity: form.severity,
      status: form.status,
      created_by: userId,
    } as any);
    if (error) {
      toast.error('Eroare la salvare');
    } else {
      toast.success('Incident adăugat');
      setShowForm(false);
      setForm({ title: '', description: '', severity: 'info', status: 'investigating' });
      fetchIncidents();
    }
    setAdding(false);
  };

  const resolveIncident = async (id: string) => {
    const { error } = await supabase
      .from('system_incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) toast.error('Eroare');
    else { toast.success('Incident rezolvat'); fetchIncidents(); }
  };

  const deleteIncident = async (id: string) => {
    const { error } = await supabase.from('system_incidents').delete().eq('id', id);
    if (error) toast.error('Eroare');
    else { toast.success('Incident șters'); fetchIncidents(); }
  };

  const severityConfig: Record<string, { icon: typeof Info; color: string; label: string }> = {
    info: { icon: Info, color: 'text-blue-500', label: 'Informativ' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', label: 'Avertizare' },
    critical: { icon: AlertCircle, color: 'text-destructive', label: 'Critic' },
  };

  const statusLabels: Record<string, string> = {
    investigating: 'În investigare',
    identified: 'Identificat',
    monitoring: 'Monitorizare',
    resolved: 'Rezolvat',
  };

  const statusColors: Record<string, string> = {
    investigating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    identified: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    monitoring: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  // Compute uptime stats
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedThisMonth = incidents.filter(i => {
    if (i.status !== 'resolved' || !i.resolved_at) return false;
    const d = new Date(i.resolved_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <div className="space-y-6">
      {/* Quick status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-3xl font-bold ${activeIncidents.length === 0 ? 'text-emerald-500' : 'text-destructive'}`}>
              {activeIncidents.length === 0 ? '✓' : activeIncidents.length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeIncidents.length === 0 ? 'Totul funcționează' : 'Incidente active'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-primary">{resolvedThisMonth.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Rezolvate luna aceasta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-muted-foreground">{incidents.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Total incidente</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />Incidente & Mentenanțe</CardTitle>
              <CardDescription>Istoricul incidentelor și al perioadelor de mentenanță</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchIncidents}><RefreshCw className="w-4 h-4 mr-1" />Reîncarcă</Button>
              <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" />Incident</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>Niciun incident înregistrat</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map(inc => {
                const sev = severityConfig[inc.severity] || severityConfig.info;
                const SevIcon = sev.icon;
                return (
                  <div key={inc.id} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                    <SevIcon className={`w-5 h-5 mt-0.5 ${sev.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{inc.title}</span>
                        <Badge className={statusColors[inc.status] || 'bg-muted'}>{statusLabels[inc.status] || inc.status}</Badge>
                        <Badge variant="outline" className="text-xs">{sev.label}</Badge>
                      </div>
                      {inc.description && <p className="text-sm text-muted-foreground mt-1">{inc.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Început: {format(new Date(inc.started_at), 'dd MMM yyyy, HH:mm', { locale: ro })}</span>
                        {inc.resolved_at && (
                          <span>Rezolvat: {format(new Date(inc.resolved_at), 'dd MMM yyyy, HH:mm', { locale: ro })}</span>
                        )}
                        {inc.status !== 'resolved' && (
                          <span>Durează: {formatDistanceToNow(new Date(inc.started_at), { locale: ro })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {inc.status !== 'resolved' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => resolveIncident(inc.id)} title="Marchează rezolvat">
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteIncident(inc.id)} title="Șterge">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incident / Mentenanță</DialogTitle>
            <DialogDescription>Adaugă un incident sau o perioadă de mentenanță</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titlu</Label>
              <Input placeholder="ex: Indisponibilitate server e-mail" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea placeholder="Detalii despre incident..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severitate</Label>
                <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Informativ</SelectItem>
                    <SelectItem value="warning">Avertizare</SelectItem>
                    <SelectItem value="critical">Critic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="investigating">În investigare</SelectItem>
                    <SelectItem value="identified">Identificat</SelectItem>
                    <SelectItem value="monitoring">Monitorizare</SelectItem>
                    <SelectItem value="resolved">Rezolvat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Anulează</Button>
            <Button onClick={handleAdd} disabled={adding || !form.title.trim()}>
              {adding ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Se salvează...</> : 'Salvează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== AUDIT EXPORT TAB ====================

function AuditExportTab() {
  const [exporting, setExporting] = useState(false);
  const [retentionDays, setRetentionDays] = useState('365');
  const [savingRetention, setSavingRetention] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [oldestEntry, setOldestEntry] = useState<string | null>(null);

  useEffect(() => {
    // Load retention setting
    supabase.from('app_settings').select('value').eq('key', 'audit_retention_days').maybeSingle()
      .then(({ data }) => {
        if (data?.value) setRetentionDays(String(data.value));
      });
    // Load audit stats
    supabase.from('audit_logs').select('id', { count: 'exact', head: true })
      .then(({ count }) => setAuditCount(count));
    supabase.from('audit_logs').select('created_at').order('created_at', { ascending: true }).limit(1)
      .then(({ data }) => {
        if (data?.[0]) setOldestEntry(data[0].created_at);
      });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;
      if (!data || data.length === 0) { toast.info('Nu există date de exportat'); setExporting(false); return; }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Audit Logs');

      ws.columns = [
        { header: 'Data', key: 'created_at', width: 20 },
        { header: 'Acțiune', key: 'action', width: 25 },
        { header: 'Tip Entitate', key: 'entity_type', width: 18 },
        { header: 'ID Entitate', key: 'entity_id', width: 38 },
        { header: 'User ID', key: 'user_id', width: 38 },
        { header: 'Detalii', key: 'details', width: 60 },
      ];

      // Style header
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      data.forEach(log => {
        ws.addRow({
          created_at: format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss'),
          action: log.action,
          entity_type: log.entity_type || '-',
          entity_id: log.entity_id || '-',
          user_id: log.user_id,
          details: log.details ? JSON.stringify(log.details) : '-',
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success(`${data.length} înregistrări exportate`);
    } catch (err) {
      toast.error('Eroare la export');
    }
    setExporting(false);
  };

  const handleSaveRetention = async () => {
    setSavingRetention(true);
    const days = parseInt(retentionDays);
    if (isNaN(days) || days < 30) {
      toast.error('Minim 30 de zile');
      setSavingRetention(false);
      return;
    }
    const { error } = await supabase.from('app_settings').upsert({
      key: 'audit_retention_days',
      value: days as any,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error('Eroare la salvare');
    else toast.success('Retenție salvată');
    setSavingRetention(false);
  };

  const handleCleanup = async () => {
    setCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-audit-logs');
      if (error) throw error;
      toast.success(`Curățare completă: ${data?.deleted_count || 0} intrări șterse`);
      // Refresh stats
      supabase.from('audit_logs').select('id', { count: 'exact', head: true })
        .then(({ count }) => setAuditCount(count));
    } catch {
      toast.error('Eroare la curățare');
    }
    setCleaningUp(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-primary">{auditCount ?? '...'}</div>
            <p className="text-sm text-muted-foreground mt-1">Total intrări audit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-muted-foreground">
              {oldestEntry ? format(new Date(oldestEntry), 'dd MMM yyyy', { locale: ro }) : '...'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Cea mai veche intrare</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-amber-500">{retentionDays}</div>
            <p className="text-sm text-muted-foreground mt-1">Zile retenție</p>
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileDown className="w-5 h-5 text-primary" />Export Audit Logs</CardTitle>
          <CardDescription>Exportă jurnalul de audit în format XLSX (ultimele 10.000 intrări)</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto">
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Se exportă...</> : <><Download className="w-4 h-4 mr-2" />Export XLSX</>}
          </Button>
        </CardContent>
      </Card>

      {/* Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-primary" />Retenție & Curățare</CardTitle>
          <CardDescription>Configurează perioada de retenție și curăță intrările vechi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <Label>Perioada de retenție (zile)</Label>
              <Input type="number" min="30" value={retentionDays} onChange={e => setRetentionDays(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Minim 30 zile. Intrările mai vechi vor fi șterse la curățare.</p>
            </div>
            <Button variant="outline" onClick={handleSaveRetention} disabled={savingRetention}>
              {savingRetention ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
            </Button>
          </div>
          <div className="border-t pt-4">
            <Button variant="destructive" onClick={handleCleanup} disabled={cleaningUp}>
              {cleaningUp ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Se curăță...</> : <><Trash2 className="w-4 h-4 mr-2" />Curăță acum</>}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Șterge intrările mai vechi de {retentionDays} zile.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN PAGE ====================

const SystemStatus = () => {
  const { user } = useAuth();
  const { role, isSuperAdmin } = useUserRole();

  if (role && !isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <MainLayout title="Stare Sistem" description="Backup, status și audit">
      <Tabs defaultValue="backup" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="backup" className="text-xs sm:text-sm">Backup & DR</TabsTrigger>
          <TabsTrigger value="status" className="text-xs sm:text-sm">Status & Incidente</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm">Audit Export</TabsTrigger>
        </TabsList>
        <TabsContent value="backup">
          {user && <BackupTab userId={user.id} />}
        </TabsContent>
        <TabsContent value="status">
          {user && <StatusTab userId={user.id} />}
        </TabsContent>
        <TabsContent value="audit">
          <AuditExportTab />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default SystemStatus;
