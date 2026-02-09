import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Loader2, Users, UserCheck, UserX } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const ActivationChart = () => {
  const [activated, setActivated] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ count: totalCount }, { count: activatedCount }] = await Promise.all([
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('employee_personal_data').select('*', { count: 'exact', head: true }).eq('is_archived', false).not('employee_record_id', 'is', null),
    ]);
    setTotal(totalCount || 0);
    setActivated(activatedCount || 0);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const pct = total > 0 ? Math.round((activated / total) * 100) : 0;
  const notActivated = total - activated;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Activare conturi</span>
          <span className="ml-auto text-lg font-bold text-primary">{pct}%</span>
        </div>
        <Progress
          value={pct}
          className={`h-2.5 mb-3 ${
            pct >= 75 ? '[&>div]:bg-green-500'
              : pct >= 50 ? '[&>div]:bg-yellow-500'
              : pct >= 25 ? '[&>div]:bg-orange-500'
              : '[&>div]:bg-red-500'
          }`}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-green-500" />
            {activated} activate
          </span>
          <span className="flex items-center gap-1">
            <UserX className="w-3.5 h-3.5 text-muted-foreground" />
            {notActivated} neactivate
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {total} total
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivationChart;
