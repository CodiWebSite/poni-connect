import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import DashboardAlertsBanner from './DashboardAlertsBanner';
import DashboardGreeting from './DashboardGreeting';
import QuickActionsGrid, { QuickAction } from './QuickActionsGrid';
import PendingActionsWidget, { PendingAction } from './PendingActionsWidget';
import DashboardAnnouncements from './DashboardAnnouncements';
import PersonalCalendarWidget from './PersonalCalendarWidget';
import ChangelogWidget from './ChangelogWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ClipboardCheck, Calendar, Users, UserCircle, CalendarCheck,
  Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface PendingLeave {
  id: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: string;
}

const SefDepartmentDashboard = () => {
  const { user } = useAuth();
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Get leave requests where this user is the dept_head or approver
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, working_days, status, user_id')
      .in('status', ['pending_department_head', 'pending_director', 'draft'] as any)
      .order('created_at', { ascending: false })
      .limit(20);

    if (leaves && leaves.length > 0) {
      // Get employee names
      const userIds = [...new Set(leaves.map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => { nameMap[p.user_id] = p.full_name || 'Necunoscut'; });

      setPendingLeaves(leaves.map(l => ({
        id: l.id,
        employeeName: nameMap[l.user_id] || 'Necunoscut',
        startDate: l.start_date,
        endDate: l.end_date,
        workingDays: l.working_days,
        status: l.status,
      })));
    }
    setLoading(false);
  };

  const pendingActions: PendingAction[] = [
    { id: 'leaves', icon: ClipboardCheck, label: 'Cereri de concediu', count: pendingLeaves.length, severity: pendingLeaves.length > 3 ? 'critical' : pendingLeaves.length > 0 ? 'warning' : 'info', link: '/leave-request' },
  ];

  const quickActions: QuickAction[] = [
    { icon: ClipboardCheck, label: 'Aprobă Cereri', path: '/leave-request', gradient: 'from-primary to-info', badge: pendingLeaves.length },
    { icon: Users, label: 'Echipa Mea', path: '/my-team', gradient: 'from-accent to-success' },
    { icon: Calendar, label: 'Calendar', path: '/leave-calendar', gradient: 'from-info to-primary' },
    { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile', gradient: 'from-warning to-destructive' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_department_head':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 text-[10px]"><Clock className="w-2.5 h-2.5 mr-0.5" />Șef dept.</Badge>;
      case 'pending_director':
        return <Badge variant="secondary" className="bg-info/10 text-info border-info/20 text-[10px]"><Clock className="w-2.5 h-2.5 mr-0.5" />Director</Badge>;
      default:
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 text-[10px]"><Clock className="w-2.5 h-2.5 mr-0.5" />Pending</Badge>;
    }
  };

  return (
    <MainLayout title="Dashboard" description="Panou șef departament">
      <DashboardAlertsBanner />
      <DashboardGreeting subtitle="Panou de lucru conducere" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <PendingActionsWidget actions={pendingActions} loading={loading} />

        {/* Recent pending leaves detail */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" />
              Cereri de Concediu Recente
              {pendingLeaves.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-xs">{pendingLeaves.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : pendingLeaves.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-success/60" />
                <p className="text-sm">Nicio cerere în așteptare</p>
              </div>
            ) : (
              <ScrollArea className={pendingLeaves.length > 4 ? 'h-[200px]' : undefined}>
                <div className="space-y-2">
                  {pendingLeaves.slice(0, 10).map(leave => (
                    <div key={leave.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{leave.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(leave.startDate), 'd MMM', { locale: ro })} — {format(new Date(leave.endDate), 'd MMM yyyy', { locale: ro })} · {leave.workingDays} zile
                        </p>
                      </div>
                      {getStatusBadge(leave.status)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements & Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <PersonalCalendarWidget />
        </div>
        <DashboardAnnouncements />
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Acțiuni Rapide</h3>
        <QuickActionsGrid actions={quickActions} columns={4} />
      </div>

      <div className="mt-4">
        <ChangelogWidget />
      </div>
    </MainLayout>
  );
};

export default SefDepartmentDashboard;
