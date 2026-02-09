import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Calendar, Loader2, ArrowRight, Briefcase, Clock } from 'lucide-react';
import WeatherWidget from './WeatherWidget';
import PersonalCalendarWidget from './PersonalCalendarWidget';
import ActivityHistory from './ActivityHistory';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface EmployeeRecord {
  hire_date: string | null;
  contract_type: string;
  total_leave_days: number;
  used_leave_days: number;
  remaining_leave_days: number;
}

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome */}
      {fullName && (
        <div>
          <h2 className="text-lg sm:text-2xl font-display font-bold text-foreground">
            Bună, {fullName.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}! 👋
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">Iată un rezumat al situației tale.</p>
        </div>
      )}

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
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="text-center p-2.5 sm:p-5 bg-green-500/10 rounded-xl border border-green-500/20">
                    <p className="text-xl sm:text-4xl font-bold text-green-600">{employeeRecord.remaining_leave_days}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Disponibile</p>
                  </div>
                  <div className="text-center p-2.5 sm:p-5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <p className="text-xl sm:text-4xl font-bold text-blue-600">{employeeRecord.used_leave_days}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Utilizate</p>
                  </div>
                  <div className="text-center p-2.5 sm:p-5 bg-muted rounded-xl border border-border">
                    <p className="text-xl sm:text-4xl font-bold text-foreground">{employeeRecord.total_leave_days}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Total</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Progres utilizare</span>
                    <span className="font-medium">{Math.round(leaveProgress)}%</span>
                  </div>
                  <Progress value={leaveProgress} className="h-2 sm:h-3" />
                </div>

                <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm">
                  <Link to="/my-profile" className="flex items-center gap-1">
                    Vezi profilul complet <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Link>
                </Button>
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
