import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { 
  Users, UserX, ShieldAlert, Clock, AlertTriangle, CheckCircle2, 
  RefreshCw, Activity, Database, HardDrive, Loader2, XCircle, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';

interface KPIData {
  totalUsers: number;
  employeesWithoutAccount: number;
  accountsWithoutRole: number;
  pendingLeaveRequests: number;
  lastBackup: string | null;
  recentAuditCount: number;
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  detail: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  user_id: string;
  created_at: string;
  details: any;
  user_name?: string;
}

const KPICard = ({ title, value, icon, iconClass, subtitle }: { 
  title: string; value: number; icon: React.ReactNode; iconClass?: string; subtitle?: string 
}) => {
  const animated = useAnimatedCounter(value);
  return (
    <Card className="group hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-display font-bold mt-1.5 text-foreground tracking-tight group-hover:text-primary transition-colors">
              {animated}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br",
            iconClass || "from-primary to-primary/70"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminOverview = () => {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [
        { count: totalUsers },
        { count: accountsWithoutRole },
        { count: pendingLeave },
        { data: lastBackupData },
        { data: auditData },
        { count: totalEpd },
        { count: linkedEpd },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('user_id', { count: 'exact', head: true })
          .not('user_id', 'in', `(SELECT user_id FROM user_roles)`),
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('backup_logs').select('created_at, status').order('created_at', { ascending: false }).limit(1),
        supabase.from('audit_logs').select('id, action, entity_type, user_id, created_at, details').order('created_at', { ascending: false }).limit(10),
        supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false),
        supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false).not('employee_record_id', 'is', null),
      ]);

      const employeesWithoutAccount = (totalEpd || 0) - (linkedEpd || 0);

      const kpiData: KPIData = {
        totalUsers: totalUsers || 0,
        employeesWithoutAccount: employeesWithoutAccount,
        accountsWithoutRole: accountsWithoutRole || 0,
        pendingLeaveRequests: pendingLeave || 0,
        lastBackup: lastBackupData?.[0]?.created_at || null,
        recentAuditCount: 0,
      };

      setKpi(kpiData);

      // Build alerts
      const newAlerts: Alert[] = [];
      if (employeesWithoutAccount > 0) {
        newAlerts.push({ type: 'warning', icon: <UserX className="w-4 h-4" />, title: 'Angajați fără cont', detail: `${employeesWithoutAccount} angajați nu au cont de utilizator` });
      }
      if ((accountsWithoutRole || 0) > 0) {
        newAlerts.push({ type: 'critical', icon: <ShieldAlert className="w-4 h-4" />, title: 'Conturi fără rol', detail: `${accountsWithoutRole} conturi nu au un rol atribuit` });
      }
      if ((pendingLeave || 0) > 0) {
        newAlerts.push({ type: 'warning', icon: <Clock className="w-4 h-4" />, title: 'Cereri în așteptare', detail: `${pendingLeave} cereri de concediu așteaptă aprobare` });
      }
      if (!lastBackupData?.[0]) {
        newAlerts.push({ type: 'critical', icon: <Database className="w-4 h-4" />, title: 'Backup lipsă', detail: 'Nu s-a înregistrat niciun backup' });
      }
      if (newAlerts.length === 0) {
        newAlerts.push({ type: 'info', icon: <CheckCircle2 className="w-4 h-4" />, title: 'Totul funcționează normal', detail: 'Nu sunt alerte active' });
      }
      setAlerts(newAlerts);

      // Enrich audit with user names
      if (auditData) {
        const userIds = [...new Set(auditData.map(a => a.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        setRecentAudit(auditData.map(a => ({ ...a, user_name: nameMap.get(a.user_id) || 'Necunoscut' })));
      }
    } catch (e) {
      console.error('AdminOverview fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[250px] rounded-xl" />
          <Skeleton className="h-[250px] rounded-xl" />
        </div>
      </div>
    );
  }

  const alertColors = {
    critical: 'border-l-destructive bg-destructive/5',
    warning: 'border-l-amber-500 bg-amber-500/5',
    info: 'border-l-blue-500 bg-blue-500/5',
  };
  const alertIconColors = {
    critical: 'text-destructive',
    warning: 'text-amber-500',
    info: 'text-blue-500',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Privire de ansamblu</h2>
          <p className="text-sm text-muted-foreground">Starea generală a platformei</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
          Actualizează
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total utilizatori" value={kpi?.totalUsers || 0} icon={<Users className="w-6 h-6 text-primary-foreground" />} iconClass="from-primary to-blue-500" />
        <KPICard title="Angajați fără cont" value={kpi?.employeesWithoutAccount || 0} icon={<UserX className="w-6 h-6 text-primary-foreground" />} iconClass="from-amber-500 to-orange-500" subtitle="Nu au acces la platformă" />
        <KPICard title="Conturi fără rol" value={kpi?.accountsWithoutRole || 0} icon={<ShieldAlert className="w-6 h-6 text-primary-foreground" />} iconClass="from-destructive to-red-400" subtitle="Necesită atribuire rol" />
        <KPICard title="Cereri în așteptare" value={kpi?.pendingLeaveRequests || 0} icon={<Clock className="w-6 h-6 text-primary-foreground" />} iconClass="from-violet-500 to-purple-500" subtitle="Concedii neaprobate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alerte prioritare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border-l-[3px] transition-colors",
                alertColors[alert.type]
              )}>
                <span className={cn("mt-0.5", alertIconColors[alert.type])}>{alert.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Activitate recentă
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nu există activitate recentă</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentAudit.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Avatar className="w-7 h-7 mt-0.5 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {entry.user_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        <span className="font-medium">{entry.user_name}</span>
                        <span className="text-muted-foreground"> — {entry.action}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {entry.entity_type && <Badge variant="outline" className="text-[10px] mr-1.5 py-0">{entry.entity_type}</Badge>}
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ro })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Status Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-500" />
            Status sistem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Baza de date', status: 'ok' as const },
              { label: 'Autentificare', status: 'ok' as const },
              { label: 'Storage', status: 'ok' as const },
              { label: 'Ultimul backup', status: kpi?.lastBackup ? 'ok' as const : 'warning' as const, detail: kpi?.lastBackup ? formatDistanceToNow(new Date(kpi.lastBackup), { addSuffix: true, locale: ro }) : 'Niciodată' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                {item.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <div>
                  <p className="text-xs font-medium text-foreground">{item.label}</p>
                  {item.detail && <p className="text-[10px] text-muted-foreground">{item.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
