import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Database, Shield, HardDrive, Zap, Mail, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, Loader2, Play, Settings, MonitorCheck, Package
} from 'lucide-react';
import UptimeMonitorPanel from './UptimeMonitorPanel';
import AppSettingsPanel from './AppSettingsPanel';
import EquipmentRegistry from './EquipmentRegistry';

type CheckStatus = 'idle' | 'running' | 'ok' | 'warning' | 'error';

interface DiagResult {
  label: string;
  status: CheckStatus;
  detail: string;
  recommendation?: string;
}

const statusIcons: Record<CheckStatus, React.ReactNode> = {
  idle: <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />,
  running: <Loader2 className="w-4 h-4 animate-spin text-primary" />,
  ok: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  error: <XCircle className="w-4 h-4 text-destructive" />,
};

const AdminSystemHealth = () => {
  const { toast } = useToast();
  const [results, setResults] = useState<DiagResult[]>([]);
  const [running, setRunning] = useState(false);

  const runDiagnostics = async () => {
    setRunning(true);
    const newResults: DiagResult[] = [];

    // 1. Database check
    try {
      const start = Date.now();
      const { error } = await supabase.from('app_settings').select('key').limit(1);
      const ms = Date.now() - start;
      newResults.push({
        label: 'Baza de date',
        status: error ? 'error' : 'ok',
        detail: error ? error.message : `Răspuns în ${ms}ms`,
      });
    } catch (e: any) {
      newResults.push({ label: 'Baza de date', status: 'error', detail: e.message });
    }
    setResults([...newResults]);

    // 2. Auth check
    try {
      const start = Date.now();
      const { error } = await supabase.auth.getSession();
      const ms = Date.now() - start;
      newResults.push({
        label: 'Autentificare',
        status: error ? 'error' : 'ok',
        detail: error ? error.message : `Sesiune validă (${ms}ms)`,
      });
    } catch (e: any) {
      newResults.push({ label: 'Autentificare', status: 'error', detail: e.message });
    }
    setResults([...newResults]);

    // 3. Storage check
    try {
      const start = Date.now();
      const { data, error } = await supabase.storage.listBuckets();
      const ms = Date.now() - start;
      newResults.push({
        label: 'Storage',
        status: error ? 'error' : 'ok',
        detail: error ? error.message : `${data?.length || 0} bucket-uri (${ms}ms)`,
      });
    } catch (e: any) {
      newResults.push({ label: 'Storage', status: 'error', detail: e.message });
    }
    setResults([...newResults]);

    // 4. Health check edge function
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke('health-check');
      const ms = Date.now() - start;
      if (error) {
        newResults.push({ label: 'Edge Functions (health-check)', status: 'warning', detail: `Eroare: ${error.message}` });
      } else {
        const overall = data?.overall || 'unknown';
        newResults.push({
          label: 'Edge Functions (health-check)',
          status: overall === 'healthy' ? 'ok' : 'warning',
          detail: `Status: ${overall} (${ms}ms)`,
        });
      }
    } catch (e: any) {
      newResults.push({ label: 'Edge Functions (health-check)', status: 'error', detail: e.message });
    }
    setResults([...newResults]);

    // 5. User consistency check
    try {
      const [{ count: totalProfiles }, { count: totalRoles }, { count: totalRecords }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }),
        supabase.from('employee_records').select('*', { count: 'exact', head: true }),
      ]);
      const missingRoles = (totalProfiles || 0) - (totalRoles || 0);
      newResults.push({
        label: 'Consistență utilizatori',
        status: missingRoles > 0 ? 'warning' : 'ok',
        detail: `${totalProfiles} profile, ${totalRoles} roluri, ${totalRecords} employee records${missingRoles > 0 ? ` — ${missingRoles} fără rol` : ''}`,
        recommendation: missingRoles > 0 ? 'Verifică tab-ul Users pentru conturi fără rol atribuit.' : undefined,
      });
    } catch (e: any) {
      newResults.push({ label: 'Consistență utilizatori', status: 'error', detail: e.message });
    }
    setResults([...newResults]);

    // 6. Backup status
    try {
      const { data } = await supabase.from('backup_logs').select('created_at, status').order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        const lastDate = new Date(data[0].created_at);
        const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        newResults.push({
          label: 'Backup',
          status: daysSince > 7 ? 'warning' : 'ok',
          detail: `Ultimul backup: acum ${daysSince} zile (${data[0].status})`,
          recommendation: daysSince > 7 ? 'Se recomandă un backup de date la fiecare 7 zile.' : undefined,
        });
      } else {
        newResults.push({ label: 'Backup', status: 'warning', detail: 'Nu există înregistrări de backup.', recommendation: 'Rulează un backup din secțiunea System Health.' });
      }
    } catch (e: any) {
      newResults.push({ label: 'Backup', status: 'error', detail: e.message });
    }
    setResults([...newResults]);

    setRunning(false);
    toast({ title: 'Diagnostic complet', description: `${newResults.filter(r => r.status === 'ok').length}/${newResults.length} verificări OK` });
  };

  const badgeVariant = (s: CheckStatus) => {
    if (s === 'ok') return 'default';
    if (s === 'warning') return 'secondary';
    if (s === 'error') return 'destructive';
    return 'outline';
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="diagnostics" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="diagnostics" className="text-xs gap-1.5"><Zap className="w-3.5 h-3.5" />Diagnostice</TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs gap-1.5"><MonitorCheck className="w-3.5 h-3.5" />Monitoring</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs gap-1.5"><Package className="w-3.5 h-3.5" />Inventar IT</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1.5"><Settings className="w-3.5 h-3.5" />Setări Sistem</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostics" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Sănătate Sistem
                  </CardTitle>
                  <CardDescription className="text-xs">Verifică starea serviciilor și consistența datelor</CardDescription>
                </div>
                <Button onClick={runDiagnostics} disabled={running} size="sm">
                  {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {running ? 'Se verifică...' : 'Rulează diagnostic'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Apasă „Rulează diagnostic" pentru a verifica starea sistemului</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={i} className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      r.status === 'ok' && 'border-emerald-500/20 bg-emerald-500/5',
                      r.status === 'warning' && 'border-amber-500/20 bg-amber-500/5',
                      r.status === 'error' && 'border-destructive/20 bg-destructive/5',
                      r.status === 'running' && 'border-primary/20 bg-primary/5',
                    )}>
                      <span className="mt-0.5">{statusIcons[r.status]}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{r.label}</p>
                          <Badge variant={badgeVariant(r.status)} className="text-[10px]">
                            {r.status === 'ok' ? 'OK' : r.status === 'warning' ? 'Atenție' : r.status === 'error' ? 'Eroare' : '...'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                        {r.recommendation && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{r.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring"><UptimeMonitorPanel /></TabsContent>
        <TabsContent value="inventory"><EquipmentRegistry /></TabsContent>
        <TabsContent value="settings"><AppSettingsPanel /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSystemHealth;
