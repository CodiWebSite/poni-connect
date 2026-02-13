import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import StatCard from '@/components/dashboard/StatCard';
import PersonalCalendarWidget from '@/components/dashboard/PersonalCalendarWidget';
import WeatherWidget from '@/components/dashboard/WeatherWidget';
import ActivityHistory from '@/components/dashboard/ActivityHistory';
import ActivationChart from '@/components/dashboard/ActivationChart';
import AdoptionTrendChart from '@/components/dashboard/AdoptionTrendChart';
import LeaveByDepartment from '@/components/dashboard/LeaveByDepartment';
import HRAlerts from '@/components/dashboard/HRAlerts';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import { StatCardSkeleton, QuickActionsSkeleton, ChartSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Users, UserCircle, Calendar, FolderDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

const quickActions = [
  { icon: UserCircle, label: 'Profilul Meu', path: '/my-profile', color: 'bg-primary/10 text-primary' },
  { icon: Calendar, label: 'Calendar Concedii', path: '/leave-calendar', color: 'bg-accent/10 text-accent' },
  { icon: FolderDown, label: 'Formulare', path: '/formulare', color: 'bg-info/10 text-info' },
];

const Dashboard = () => {
  const { role, loading: roleLoading } = useUserRole();
  const [stats, setStats] = useState({ employees: 0 });

  useEffect(() => {
    if (role && role !== 'user') fetchData();
  }, [role]);

  const fetchData = async () => {
    const { count } = await supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false);
    setStats({ employees: count || 0 });
  };

  if (role === 'user') {
    return (
      <MainLayout title="Dashboard" description="Bine ați venit în intranetul ICMPP">
        <EmployeeDashboard />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard" description="Bine ați venit în intranetul ICMPP">
      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {quickActions.map((action) => (
          <Link key={action.path} to={action.path} className="group">
            <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/30 hover:scale-[1.02] hover:-translate-y-0.5">
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color} group-hover:scale-105 transition-transform`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground hidden sm:block">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Angajați"
          value={stats.employees}
          icon={Users}
          iconClassName="bg-primary"
        />
        <ActivationChart />
      </div>

      {/* HR Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <AdoptionTrendChart />
        </div>
        <HRAlerts />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <LeaveByDepartment />
        </div>
        <WeatherWidget />
      </div>

      {/* Calendar & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PersonalCalendarWidget />
        </div>
        <ActivityHistory />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
