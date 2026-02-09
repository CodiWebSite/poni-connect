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
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Users } from 'lucide-react';

const Dashboard = () => {
  const { role, loading: roleLoading } = useUserRole();
  const [stats, setStats] = useState({ employees: 0 });

  useEffect(() => {
    if (role && role !== 'user') fetchData();
  }, [role]);

  const fetchData = async () => {
    const { count } = await supabase.from('employee_personal_data').select('*', { count: 'exact', head: true });
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
