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
    <div className="space-y-6">
      {/* Welcome */}
      {fullName && (
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            Bună, {fullName.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}! 👋
          </h2>
          <p className="text-muted-foreground mt-1">Iată un rezumat al situației tale.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Balance - Main focus */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Sold Zile Concediu — {new Date().getFullYear()}
            </CardTitle>
            <CardDescription>Situația zilelor de concediu de odihnă</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeRecord ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="text-center p-3 sm:p-5 bg-green-500/10 rounded-xl border border-green-500/20">
                    <p className="text-2xl sm:text-4xl font-bold text-green-600">{employeeRecord.remaining_leave_days}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Disponibile</p>
                  </div>
                  <div className="text-center p-3 sm:p-5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <p className="text-2xl sm:text-4xl font-bold text-blue-600">{employeeRecord.used_leave_days}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Utilizate</p>
                  </div>
                  <div className="text-center p-3 sm:p-5 bg-muted rounded-xl border border-border">
                    <p className="text-2xl sm:text-4xl font-bold text-foreground">{employeeRecord.total_leave_days}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Total</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progres utilizare</span>
                    <span className="font-medium">{Math.round(leaveProgress)}%</span>
                  </div>
                  <Progress value={leaveProgress} className="h-3" />
                </div>


                <Button variant="outline" size="sm" asChild>
                  <Link to="/my-profile" className="flex items-center gap-1">
                    Vezi profilul complet <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nu există date despre concediu.</p>
                <p className="text-sm">Contactați departamentul HR pentru actualizare.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side widgets */}
        <div className="space-y-6">
          <PersonalCalendarWidget />
          <WeatherWidget />
          <ActivityHistory />
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
