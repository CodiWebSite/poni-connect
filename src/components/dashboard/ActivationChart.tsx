import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface MonthlyData {
  month: string;
  label: string;
  activatedThisMonth: number;
  cumulativeActivated: number;
  totalEmployees: number;
}

const ActivationChart = () => {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch all employee records with created_at (activation date proxy)
    const { data: records } = await supabase
      .from('employee_records')
      .select('created_at')
      .order('created_at', { ascending: true });

    // Fetch total employees count
    const { count: totalEmployees } = await supabase
      .from('employee_personal_data')
      .select('*', { count: 'exact', head: true });

    if (!records || records.length === 0) {
      setLoading(false);
      return;
    }

    // Group by month
    const monthMap = new Map<string, number>();
    records.forEach(r => {
      const month = format(new Date(r.created_at), 'yyyy-MM');
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    });

    // Build cumulative data
    const sortedMonths = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    const chartData: MonthlyData[] = sortedMonths.map(([month, count]) => {
      cumulative += count;
      return {
        month,
        label: format(new Date(month + '-01'), 'MMM yyyy', { locale: ro }),
        activatedThisMonth: count,
        cumulativeActivated: cumulative,
        totalEmployees: totalEmployees || 0,
      };
    });

    setData(chartData);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-primary" />
          Evoluție activare conturi
        </CardTitle>
        <CardDescription>Conturi activate cumulativ pe luni</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActivated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  cumulativeActivated: 'Total activat',
                  totalEmployees: 'Total angajați',
                };
                return [value, labels[name] || name];
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeActivated"
              stroke="hsl(var(--primary))"
              fill="url(#colorActivated)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="totalEmployees"
              stroke="hsl(var(--muted-foreground))"
              fill="none"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ActivationChart;
