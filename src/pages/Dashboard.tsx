import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import MainLayout from '@/components/layout/MainLayout';
import StatCard from '@/components/dashboard/StatCard';
import PersonalCalendarWidget from '@/components/dashboard/PersonalCalendarWidget';
import WeatherWidget from '@/components/dashboard/WeatherWidget';
import { Progress } from '@/components/ui/progress';
import ActivityHistory from '@/components/dashboard/ActivityHistory';
import ActivationChart from '@/components/dashboard/ActivationChart';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Users, UserCheck, UserX } from 'lucide-react';

const Dashboard = () => {
  const { role, loading: roleLoading } = useUserRole();
  const [stats, setStats] = useState({
    employees: 0,
    employeesWithAccount: 0,
  });

  useEffect(() => {
    if (role && role !== 'user') fetchData();
  }, [role]);

  const fetchData = async () => {
    const [employeesCount, employeesWithAccountCount] = await Promise.all([
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }),
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).not('employee_record_id', 'is', null),
    ]);

    setStats({
      employees: employeesCount.count || 0,
      employeesWithAccount: employeesWithAccountCount.count || 0,
    });
  };

  // Show simplified dashboard for regular employees
  if (role === 'user') {
    return (
      <MainLayout title="Dashboard" description="Bine ați venit în intranetul ICMPP">
        <EmployeeDashboard />
      </MainLayout>
    );
  }

  const activationPct = stats.employees > 0 ? Math.round((stats.employeesWithAccount / stats.employees) * 100) : 0;

  return (
    <MainLayout title="Dashboard" description="Bine ați venit în intranetul ICMPP">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard
          title="Angajați"
          value={stats.employees}
          icon={Users}
          iconClassName="bg-primary"
        />
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex gap-4 w-full">
            <div className="flex items-center gap-2 flex-1">
              <UserCheck className="w-5 h-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{stats.employeesWithAccount}</p>
                <p className="text-xs text-muted-foreground">Cu cont</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <UserX className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{stats.employees - stats.employeesWithAccount}</p>
                <p className="text-xs text-muted-foreground">Fără cont</p>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Activare conturi</span>
              <span className="font-medium text-foreground">{activationPct}%</span>
            </div>
            <Progress 
              value={activationPct} 
              className={`h-2 ${
                activationPct >= 75 ? '[&>div]:bg-green-500'
                  : activationPct >= 50 ? '[&>div]:bg-yellow-500'
                  : activationPct >= 25 ? '[&>div]:bg-orange-500'
                  : '[&>div]:bg-red-500'
              }`}
            />
          </div>
        </Card>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PersonalCalendarWidget />
        </div>
        <div className="space-y-6">
          <ActivationChart />
          <WeatherWidget />
          <ActivityHistory />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
