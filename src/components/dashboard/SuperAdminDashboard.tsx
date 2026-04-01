import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import DashboardAlertsBanner from './DashboardAlertsBanner';
import DashboardGreeting from './DashboardGreeting';
import QuickActionsGrid, { QuickAction } from './QuickActionsGrid';
import PendingActionsWidget, { PendingAction } from './PendingActionsWidget';
import SystemHealthMini from './SystemHealthMini';
import StatCard from './StatCard';
import ActivationChart from './ActivationChart';
import OnlineUsersWidget from './OnlineUsersWidget';
import AnalyticsWidget from './AnalyticsWidget';
import AdoptionTrendChart from './AdoptionTrendChart';
import ChangelogWidget from './ChangelogWidget';
import DashboardAnnouncements from './DashboardAnnouncements';
import {
  Users, ShieldCheck, ScrollText, Settings, Activity, UserPlus,
  TicketCheck, FileWarning, UserX, Inbox, Database, HeartPulse,
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({ employees: 0, usersNoRole: 0, employeesNoAccount: 0 });
  const [pending, setPending] = useState({ helpdesk: 0, accountRequests: 0, corrections: 0, hrPending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [
      { count: empCount },
      { data: helpdeskData },
      { data: accountData },
      { data: correctionsData },
      { data: hrData },
      { data: profilesData },
      { data: rolesData },
      { data: epdData },
    ] = await Promise.all([
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('helpdesk_tickets').select('id').eq('status', 'open'),
      supabase.from('account_requests').select('id').eq('status', 'pending'),
      supabase.from('data_correction_requests').select('id').eq('status', 'pending'),
      supabase.from('hr_requests').select('id').in('status', ['pending', 'pending_department_head', 'pending_director']),
      supabase.from('profiles').select('user_id'),
      supabase.from('user_roles').select('user_id'),
      supabase.from('employee_personal_data').select('email').eq('is_archived', false),
    ]);

    // Users without roles
    const roleUserIds = new Set((rolesData || []).map(r => r.user_id));
    const usersNoRole = (profilesData || []).filter(p => !roleUserIds.has(p.user_id)).length;

    // Employees without accounts (email not in profiles)
    const profileEmails = new Set<string>(); // can't easily get emails from profiles, skip for now
    const employeesNoAccount = 0; // This would require auth.users which we can't query

    setStats({ employees: empCount || 0, usersNoRole, employeesNoAccount });
    setPending({
      helpdesk: (helpdeskData || []).length,
      accountRequests: (accountData || []).length,
      corrections: (correctionsData || []).length,
      hrPending: (hrData || []).length,
    });
    setLoading(false);
  };

  const pendingActions: PendingAction[] = [
    { id: 'helpdesk', icon: TicketCheck, label: 'Tichete HelpDesk noi', count: pending.helpdesk, severity: pending.helpdesk > 5 ? 'critical' : 'warning', link: '/admin' },
    { id: 'accounts', icon: UserPlus, label: 'Cereri de cont', count: pending.accountRequests, severity: 'warning', link: '/admin' },
    { id: 'corrections', icon: FileWarning, label: 'Cereri corecție date', count: pending.corrections, severity: 'info', link: '/hr' },
    { id: 'hr', icon: Inbox, label: 'Cereri HR în așteptare', count: pending.hrPending, severity: pending.hrPending > 10 ? 'critical' : 'warning', link: '/hr' },
    { id: 'norole', icon: UserX, label: 'Utilizatori fără rol', count: stats.usersNoRole, severity: stats.usersNoRole > 0 ? 'warning' : 'info', link: '/admin' },
  ];

  const quickActions: QuickAction[] = [
    { icon: UserPlus, label: 'Creează Cont', path: '/admin', gradient: 'from-primary to-info' },
    { icon: ShieldCheck, label: 'Roluri', path: '/admin', gradient: 'from-accent to-success' },
    { icon: ScrollText, label: 'Audit', path: '/admin', gradient: 'from-info to-primary' },
    { icon: Settings, label: 'Admin', path: '/admin', gradient: 'from-muted-foreground to-foreground' },
    { icon: Activity, label: 'System Health', path: '/admin', gradient: 'from-success to-accent' },
    { icon: HeartPulse, label: 'Status Sistem', path: '/system-status', gradient: 'from-destructive to-warning' },
  ];

  return (
    <MainLayout title="Control Center" description="Panou de comandă Super Admin">
      <DashboardAlertsBanner />
      <DashboardGreeting subtitle="Centru de control administrativ" />

      {/* Alerts & Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <PendingActionsWidget title="Necesită atenție" actions={pendingActions} loading={loading} />
        <SystemHealthMini />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <StatCard title="Angajați Activi" value={stats.employees} icon={Users} iconClassName="from-primary to-info" />
        <ActivationChart />
        <OnlineUsersWidget />
      </div>

      {/* Analytics */}
      <div className="mt-4">
        <AnalyticsWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <AdoptionTrendChart />
        </div>
        <DashboardAnnouncements />
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Acțiuni Rapide</h3>
        <QuickActionsGrid actions={quickActions} columns={3} />
      </div>

      <div className="mt-4">
        <ChangelogWidget />
      </div>
    </MainLayout>
  );
};

export default SuperAdminDashboard;
