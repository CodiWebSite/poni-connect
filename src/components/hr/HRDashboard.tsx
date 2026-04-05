import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, UserCheck, UserX, FileWarning, Clock, AlertTriangle,
  FileText, Activity, Archive, ShieldAlert, CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

interface KPIData {
  activeEmployees: number;
  newThisMonth: number;
  archivedEmployees: number;
  withoutAccount: number;
  withoutRole: number;
  pendingCorrections: number;
  pendingHRRequests: number;
  expiredDocuments: number;
  expiringDocuments: number;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  user_id: string;
  details: any;
  user_name?: string;
}

function KPICard({ icon: Icon, value, label, color, subValue }: {
  icon: any; value: number; label: string; color: string; subValue?: string;
}) {
  const animatedValue = useAnimatedCounter(value);
  return (
    <Card className="border-border/60 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 group">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight">{animatedValue}</p>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HRDashboard() {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    // Parallel queries
    const [
      { count: activeCount },
      { count: newCount },
      { count: archivedCount },
      { count: noAccountCount },
      { count: pendingCorr },
      { count: pendingHR },
      { data: expiringCI },
      { data: auditData },
      { data: profiles },
    ] = await Promise.all([
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false).gte('employment_date', monthStart),
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', true),
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false).is('employee_record_id', null),
      supabase.from('data_correction_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('hr_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('employee_personal_data').select('ci_expiry_date').eq('is_archived', false).not('ci_expiry_date', 'is', null),
      supabase.from('audit_logs').select('*').in('entity_type', ['employee_personal_data', 'employee_records', 'hr_request', 'employee_documents']).order('created_at', { ascending: false }).limit(15),
      supabase.from('profiles').select('user_id, full_name'),
    ]);

    // Count expired & expiring CI
    let expired = 0;
    let expiring = 0;
    (expiringCI || []).forEach((row: any) => {
      if (row.ci_expiry_date < today) expired++;
      else if (row.ci_expiry_date <= thirtyDaysFromNow) expiring++;
    });

    // Map profile names to audit entries
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });

    const enrichedAudit = (auditData || []).map((a: any) => ({
      ...a,
      user_name: nameMap[a.user_id] || 'Sistem',
    }));

    setKpi({
      activeEmployees: activeCount || 0,
      newThisMonth: newCount || 0,
      archivedEmployees: archivedCount || 0,
      withoutAccount: noAccountCount || 0,
      withoutRole: 0,
      pendingCorrections: pendingCorr || 0,
      pendingHRRequests: pendingHR || 0,
      expiredDocuments: expired,
      expiringDocuments: expiring,
    });

    setRecentActivity(enrichedAudit);
    setLoading(false);
  };

  const actionLabels: Record<string, string> = {
    employee_edit: 'Editare angajat',
    employee_archive: 'Arhivare angajat',
    employee_restore: 'Restaurare angajat',
    employee_import: 'Import angajați',
    department_rename: 'Redenumire departament',
    document_upload: 'Încărcare document',
    leave_manual: 'Concediu manual',
    ci_scan_upload: 'Scanare CI',
    personal_data_update: 'Actualizare date personale',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!kpi) return null;

  const alerts = [
    kpi.pendingCorrections > 0 && { label: `${kpi.pendingCorrections} cereri corecție date`, severity: 'warning' as const, icon: FileText },
    kpi.pendingHRRequests > 0 && { label: `${kpi.pendingHRRequests} cereri HR în așteptare`, severity: 'warning' as const, icon: Clock },
    kpi.expiredDocuments > 0 && { label: `${kpi.expiredDocuments} documente CI expirate`, severity: 'critical' as const, icon: ShieldAlert },
    kpi.expiringDocuments > 0 && { label: `${kpi.expiringDocuments} CI expiră în 30 zile`, severity: 'warning' as const, icon: AlertTriangle },
    kpi.withoutAccount > 0 && { label: `${kpi.withoutAccount} angajați fără cont`, severity: 'info' as const, icon: UserX },
  ].filter(Boolean) as { label: string; severity: 'warning' | 'critical' | 'info'; icon: any }[];

  const severityColors = {
    critical: 'border-destructive/30 bg-destructive/5 text-destructive',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
    info: 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400',
  };

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} value={kpi.activeEmployees} label="Angajați Activi" color="from-primary to-primary/70" />
        <KPICard icon={CalendarDays} value={kpi.newThisMonth} label="Noi Luna Aceasta" color="from-emerald-500 to-emerald-600" />
        <KPICard icon={Archive} value={kpi.archivedEmployees} label="Arhivați" color="from-muted-foreground/60 to-muted-foreground/40" />
        <KPICard icon={UserX} value={kpi.withoutAccount} label="Fără Cont" color="from-amber-500 to-amber-600" />
        <KPICard icon={FileText} value={kpi.pendingCorrections} label="Cereri Corecție" color="from-blue-500 to-blue-600" />
        <KPICard icon={Clock} value={kpi.pendingHRRequests} label="Cereri HR Pending" color="from-purple-500 to-purple-600" />
        <KPICard icon={FileWarning} value={kpi.expiredDocuments} label="CI Expirate" color="from-destructive to-destructive/70" />
        <KPICard icon={AlertTriangle} value={kpi.expiringDocuments} label="CI Expiră Curând" color="from-amber-500 to-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Alerte Prioritare
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${severityColors[alert.severity]}`}>
                  <alert.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{alert.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Activitate Recentă HR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu există activitate recentă.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <Avatar className="w-7 h-7 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {(entry.user_name || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{entry.user_name}</span>
                        {' — '}
                        <span className="text-muted-foreground">
                          {actionLabels[entry.action] || entry.action}
                        </span>
                      </p>
                      {entry.details?.employee_name && (
                        <p className="text-xs text-muted-foreground">{entry.details.employee_name}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm', { locale: ro })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
