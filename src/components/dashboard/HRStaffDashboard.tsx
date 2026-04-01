import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import DashboardAlertsBanner from './DashboardAlertsBanner';
import DashboardGreeting from './DashboardGreeting';
import QuickActionsGrid, { QuickAction } from './QuickActionsGrid';
import PendingActionsWidget, { PendingAction } from './PendingActionsWidget';
import StatCard from './StatCard';
import HRAlerts from './HRAlerts';
import LeaveByDepartment from './LeaveByDepartment';
import ChangelogWidget from './ChangelogWidget';
import DashboardAnnouncements from './DashboardAnnouncements';
import {
  Users, FileWarning, Inbox, CreditCard, Calendar, ClipboardList,
  FolderOpen, AlertTriangle, UserX,
} from 'lucide-react';

const HRStaffDashboard = () => {
  const [stats, setStats] = useState({ employees: 0, noAccount: 0 });
  const [pending, setPending] = useState({ corrections: 0, hrPending: 0, ciExpiring: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [
      { count: empCount },
      { data: correctionsData },
      { data: hrData },
      { data: ciData },
    ] = await Promise.all([
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('data_correction_requests').select('id').eq('status', 'pending'),
      supabase.from('hr_requests').select('id').in('status', ['pending', 'pending_department_head', 'pending_director'] as any),
      supabase.from('employee_personal_data').select('id').eq('is_archived', false).not('ci_expiry_date', 'is', null).lte('ci_expiry_date', in90Days),
    ]);

    setStats({ employees: empCount || 0, noAccount: 0 });
    setPending({
      corrections: (correctionsData || []).length,
      hrPending: (hrData || []).length,
      ciExpiring: (ciData || []).length,
    });
    setLoading(false);
  };

  const pendingActions: PendingAction[] = [
    { id: 'corrections', icon: FileWarning, label: 'Cereri corecție date', count: pending.corrections, severity: 'warning', link: '/hr' },
    { id: 'hr', icon: Inbox, label: 'Cereri HR în așteptare', count: pending.hrPending, severity: pending.hrPending > 5 ? 'critical' : 'warning', link: '/hr' },
    { id: 'ci', icon: CreditCard, label: 'CI expiră curând (90 zile)', count: pending.ciExpiring, severity: pending.ciExpiring > 0 ? 'warning' : 'info', link: '/hr' },
  ];

  const quickActions: QuickAction[] = [
    { icon: ClipboardList, label: 'Gestiune HR', path: '/hr', gradient: 'from-primary to-info', badge: pending.hrPending },
    { icon: Calendar, label: 'Calendar Concedii', path: '/leave-calendar', gradient: 'from-accent to-success' },
    { icon: FolderOpen, label: 'Documente', path: '/hr', gradient: 'from-info to-primary' },
    { icon: AlertTriangle, label: 'Alerte HR', path: '/hr', gradient: 'from-warning to-destructive' },
  ];

  return (
    <MainLayout title="Dashboard HR" description="Centru operațional Resurse Umane">
      <DashboardAlertsBanner />
      <DashboardGreeting subtitle="Centru operațional HR" />

      {/* Pending + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <PendingActionsWidget actions={pendingActions} loading={loading} />
        <div className="space-y-3">
          <StatCard title="Angajați Activi" value={stats.employees} icon={Users} iconClassName="from-primary to-info" />
        </div>
      </div>

      {/* HR Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <LeaveByDepartment />
        </div>
        <HRAlerts />
      </div>

      {/* Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <DashboardAnnouncements />
        </div>
        <ChangelogWidget />
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Acțiuni Rapide</h3>
        <QuickActionsGrid actions={quickActions} columns={4} />
      </div>
    </MainLayout>
  );
};

export default HRStaffDashboard;
