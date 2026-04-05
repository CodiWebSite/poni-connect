import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

const PersonalLeaveWidget = () => {
  const { user } = useAuth();
  const [record, setRecord] = useState<{ total: number; used: number; remaining: number; carryover: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('employee_records')
        .select('total_leave_days, used_leave_days, remaining_leave_days, id')
        .eq('user_id', user.id)
        .single();
      
      let carryoverDays = 0;
      if (data) {
        // Get carryover info
        const { data: epd } = await supabase
          .from('employee_personal_data')
          .select('id')
          .eq('employee_record_id', data.id)
          .maybeSingle();
        if (epd) {
          const currentYear = new Date().getFullYear();
          const { data: co } = await supabase
            .from('leave_carryover')
            .select('remaining_days')
            .eq('employee_personal_data_id', epd.id)
            .eq('from_year', currentYear - 1)
            .eq('to_year', currentYear)
            .maybeSingle();
          carryoverDays = co?.remaining_days || 0;
        }
        setRecord({
          total: data.total_leave_days,
          used: data.used_leave_days,
          remaining: data.remaining_leave_days ?? (data.total_leave_days - data.used_leave_days),
          carryover: carryoverDays,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const totalAvailable = (record?.remaining || 0) + (record?.carryover || 0);
  const totalAll = (record?.total || 0) + (record?.carryover || 0) + (record?.used || 0);
  const progress = totalAll > 0 ? ((record?.used || 0) / totalAll) * 100 : 0;
  const animatedRemaining = useAnimatedCounter(totalAvailable);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!record) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nu există date despre concediu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-primary" />
          Sold Concediu {new Date().getFullYear()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <ProgressRing value={progress} size={90} strokeWidth={8}>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{animatedRemaining}</p>
              <p className="text-[9px] text-muted-foreground">disponibile</p>
            </div>
          </ProgressRing>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full">
            {record.carryover > 0 && (
              <div className="text-center p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">{record.carryover}</p>
                <p className="text-[9px] text-muted-foreground">Report {new Date().getFullYear() - 1}</p>
              </div>
            )}
            <div className="text-center p-2 bg-success/10 rounded-lg border border-success/20">
              <p className="text-base sm:text-lg font-bold text-success">{record.remaining}</p>
              <p className="text-[9px] text-muted-foreground">Curent {new Date().getFullYear()}</p>
            </div>
            <div className="text-center p-2 bg-info/10 rounded-lg border border-info/20">
              <p className="text-base sm:text-lg font-bold text-info">{record.used}</p>
              <p className="text-[9px] text-muted-foreground">Utilizate</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg border border-border">
              <p className="text-base sm:text-lg font-bold text-foreground">{record.total}</p>
              <p className="text-[9px] text-muted-foreground">Total {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalLeaveWidget;
