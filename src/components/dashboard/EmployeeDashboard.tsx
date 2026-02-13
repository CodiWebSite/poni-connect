import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight, UserCircle, FolderDown } from 'lucide-react';
import WeatherWidget from './WeatherWidget';
import PersonalCalendarWidget from './PersonalCalendarWidget';
import ActivityHistory from './ActivityHistory';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { QuickActionsSkeleton, LeaveBalanceSkeleton, ChartSkeleton } from './DashboardSkeleton';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface EmployeeRecord {
  hire_date: string | null;
  contract_type: string;
  total_leave_days: number;
  used_leave_days: number;
  remaining_leave_days: number;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bună dimineața';
  if (hour < 18) return 'Bună ziua';
  return 'Bună seara';
};

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const [{ data: profile }, { data: record }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('user_id', user.id).single(),
      supabase.from('employee_records').select('hire_date, contract_type, total_leave_days, used_leave_days, remaining_leave_days').eq('user_id', user.id).single(),
    ]);

    if (profile) setFullName(profile.full_name || '');
    if (record) setEmployeeRecord(record);
    setLoading(false);
  };

  const leaveProgress = employeeRecord
    ? (employeeRecord.used_leave_days / employeeRecord.total_leave_days) * 100
    : 0;

  const today = format(new Date(), 'd MMMM yyyy', { locale: ro });

  const animatedRemaining = useAnimatedCounter(employeeRecord?.remaining_leave_days || 0);
  const animatedUsed = useAnimatedCounter(employeeRecord?.used_leave_days || 0);
  const animatedTotal = useAnimatedCounter(employeeRecord?.total_leave_days || 0);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-fade-in">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse mt-2" />
        </div>
        <QuickActionsSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <LeaveBalanceSkeleton />
          <div className="space-y-4">
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome with contextual greeting */}
      <div className="animate-fade-in">
        <h2 className="text-lg sm:text-2xl font-display font-bold text-foreground">
          {getGreeting()}, {fullName ? fullName.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') : 'utilizator'}! 👋
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
          {today} — Iată un rezumat al situației tale.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: '/my-profile', icon: UserCircle, label: 'Profilul Meu', color: 'bg-primary/10 group-hover:bg-primary/20 text-primary' },
          { to: '/leave-calendar', icon: Calendar, label: 'Calendar', color: 'bg-accent/10 group-hover:bg-accent/20 text-accent' },
          { to: '/formulare', icon: FolderDown, label: 'Formulare', color: 'bg-info/10 group-hover:bg-info/20 text-info' },
        ].map(action => (
          <Link key={action.to} to={action.to} className="group">
            <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/30 hover:scale-[1.02] hover:-translate-y-0.5 h-full">
              <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-2">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${action.color}`}>
                  <action.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Leave Balance */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Sold Concediu — {new Date().getFullYear()}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Situația zilelor de concediu de odihnă</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {employeeRecord ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Progress Ring */}
                <ProgressRing value={leaveProgress} size={140} strokeWidth={12}>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{animatedRemaining}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">disponibile</p>
                  </div>
                </ProgressRing>

                {/* Stats */}
                <div className="flex-1 space-y-4 w-full">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="text-center p-2.5 sm:p-4 bg-green-500/10 rounded-xl border border-green-500/20 hover:scale-[1.03] transition-transform">
                      <p className="text-xl sm:text-3xl font-bold text-green-600">{animatedRemaining}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Disponibile</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 hover:scale-[1.03] transition-transform">
                      <p className="text-xl sm:text-3xl font-bold text-blue-600">{animatedUsed}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Utilizate</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-4 bg-muted rounded-xl border border-border hover:scale-[1.03] transition-transform">
                      <p className="text-xl sm:text-3xl font-bold text-foreground">{animatedTotal}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Total</p>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm">
                    <Link to="/my-profile" className="flex items-center gap-1">
                      Vezi profilul complet <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm">Nu există date despre concediu.</p>
                <p className="text-xs">Contactați departamentul HR pentru actualizare.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side widgets */}
        <div className="space-y-4 sm:space-y-6">
          <PersonalCalendarWidget />
          <WeatherWidget />
          <ActivityHistory />
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
