import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import DashboardAnnouncements from '@/components/dashboard/DashboardAnnouncements';
import StatCard from '@/components/dashboard/StatCard';
import PersonalCalendarWidget from '@/components/dashboard/PersonalCalendarWidget';
import WeatherWidget from '@/components/dashboard/WeatherWidget';
import ActivityHistory from '@/components/dashboard/ActivityHistory';
import ActivationChart from '@/components/dashboard/ActivationChart';
import AnalyticsWidget from '@/components/dashboard/AnalyticsWidget';
import ChangelogWidget from '@/components/dashboard/ChangelogWidget';
import AdoptionTrendChart from '@/components/dashboard/AdoptionTrendChart';
import LeaveByDepartment from '@/components/dashboard/LeaveByDepartment';
import HRAlerts from '@/components/dashboard/HRAlerts';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import OnlineUsersWidget from '@/components/dashboard/OnlineUsersWidget';
import { StatCardSkeleton, QuickActionsSkeleton, ChartSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Users, UserCircle, Calendar, FolderDown, Info } from 'lucide-react';
import ContextualHelp from '@/components/shared/ContextualHelp';
import SpringDecoration from '@/components/dashboard/SpringDecoration';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

const quickActions = [
  { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile', gradient: 'from-primary to-info' },
  { icon: Calendar, label: 'Calendar Concedii', path: '/leave-calendar', gradient: 'from-accent to-success' },
  { icon: FolderDown, label: 'Formulare', path: '/formulare', gradient: 'from-info to-primary' },
];

const Dashboard = () => {
  const { role, isSuperAdmin, isHR, isSefSRUS, loading: roleLoading } = useUserRole();
  const isAdminDashboard = isSuperAdmin || isHR || isSefSRUS;
  const { settings } = useAppSettings();
  const [stats, setStats] = useState({ employees: 0 });

  useEffect(() => {
    if (isAdminDashboard) fetchData();
  }, [isAdminDashboard]);

  const fetchData = async () => {
    const { count } = await supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false);
    setStats({ employees: count || 0 });
  };

  if (!isAdminDashboard) {
    return (
      <MainLayout title="Dashboard" description={<span className="inline-flex items-center gap-1">Bine ați venit în intranetul ICMPP <ContextualHelp title="Dashboard" content="Aceasta este pagina principală a platformei. De aici accesați rapid profilul, calendarul de concedii și formulare." /></span>}>
        {settings.homepage_message && (
          <div className="mb-3 md:mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 md:px-4 py-2 md:py-3">
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs md:text-sm text-foreground whitespace-pre-line">{settings.homepage_message}</p>
          </div>
        )}
        <DashboardAnnouncements />
        <EmployeeDashboard />
        <div className="mt-4 md:mt-6">
          <ChangelogWidget />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard" description={<span className="inline-flex items-center gap-1">Bine ați venit în intranetul ICMPP <ContextualHelp title="Dashboard" content="Aceasta este pagina principală. Vedeți statisticile generale, alertele HR și calendarul personal." /></span>}>
      <SpringDecoration />
      {/* Custom homepage message */}
      {settings.homepage_message && (
        <div className="mb-3 md:mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 md:px-4 py-2 md:py-3">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs md:text-sm text-foreground whitespace-pre-line">{settings.homepage_message}</p>
        </div>
      )}
      {/* Announcements */}
      <div className="mb-4 md:mb-6">
        <DashboardAnnouncements />
      </div>
      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6">
        {quickActions.map((action) => (
          <Link key={action.path} to={action.path} className="group">
            <Card className="hover:shadow-card-hover transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 overflow-hidden relative">
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 pointer-events-none" />
              <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 relative">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${action.gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <span className="text-[11px] sm:text-sm font-medium text-foreground text-center sm:text-left leading-tight">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-1 ${isSuperAdmin ? 'sm:grid-cols-2 md:grid-cols-3' : 'md:grid-cols-2'} gap-3 md:gap-4 mb-4 md:mb-6`}>
        <StatCard
          title="Angajați"
          value={stats.employees}
          icon={Users}
          iconClassName="from-primary to-info"
        />
        <ActivationChart />
        {isSuperAdmin && <OnlineUsersWidget />}
      </div>

      {/* Analytics de adopție - doar admin */}
      {(isSuperAdmin || role === 'admin') && (
        <div className="mb-4 md:mb-6">
          <AnalyticsWidget />
        </div>
      )}

      {/* HR Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="lg:col-span-2">
          <AdoptionTrendChart />
        </div>
        <HRAlerts />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="lg:col-span-2">
          <LeaveByDepartment />
        </div>
        <ChangelogWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="lg:col-span-2">
          <PersonalCalendarWidget />
        </div>
        <WeatherWidget />
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <ActivityHistory />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
