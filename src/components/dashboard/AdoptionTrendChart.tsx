import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

interface MonthData {
  month: string;
  label: string;
  totalImported: number;
  activated: number;
  rate: number;
}

const AdoptionTrendChart = () => {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Get all non-archived employees with their created_at and employee_record_id
    const { data: employees } = await supabase
      .from('employee_personal_data')
      .select('created_at, employee_record_id')
      .eq('is_archived', false)
      .order('created_at');

    if (!employees || employees.length === 0) {
      setLoading(false);
      return;
    }

    // Get activation dates from employee_records
    const { data: records } = await supabase
      .from('employee_records')
      .select('id, created_at')
      .order('created_at');

    const recordDates: Record<string, string> = {};
    (records || []).forEach(r => { recordDates[r.id] = r.created_at; });

    // Build monthly cumulative data
    const monthMap: Record<string, { imported: number; activated: number }> = {};

    // Find date range
    const firstDate = parseISO(employees[0].created_at);
    const now = new Date();
    
    // Generate all months in range
    const current = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (current <= now) {
      const key = format(current, 'yyyy-MM');
      monthMap[key] = { imported: 0, activated: 0 };
      current.setMonth(current.getMonth() + 1);
    }

    // Count imports per month
    employees.forEach(e => {
      const key = format(parseISO(e.created_at), 'yyyy-MM');
      if (monthMap[key]) monthMap[key].imported++;
    });

    // Count activations per month
    employees.forEach(e => {
      if (e.employee_record_id && recordDates[e.employee_record_id]) {
        const key = format(parseISO(recordDates[e.employee_record_id]), 'yyyy-MM');
        if (monthMap[key]) monthMap[key].activated++;
      }
    });

    // Build cumulative data
    const sorted = Object.keys(monthMap).sort();
    let cumImported = 0;
    let cumActivated = 0;
    const chartData: MonthData[] = sorted.map(key => {
      cumImported += monthMap[key].imported;
      cumActivated += monthMap[key].activated;
      return {
        month: key,
        label: format(parseISO(`${key}-01`), 'MMM yyyy', { locale: ro }),
        totalImported: cumImported,
        activated: cumActivated,
        rate: cumImported > 0 ? Math.round((cumActivated / cumImported) * 100) : 0,
      };
    });

    setData(chartData);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Nu există date suficiente pentru grafic.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Evoluție adoptare platformă
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                </linearGradient>
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
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [
                  value,
                  name === 'totalImported' ? 'Total importați' : 'Conturi activate',
                ]}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="totalImported"
                stroke="hsl(var(--muted-foreground))"
                fill="url(#colorTotal)"
                strokeWidth={1.5}
                name="totalImported"
              />
              <Area
                type="monotone"
                dataKey="activated"
                stroke="hsl(var(--primary))"
                fill="url(#colorActivated)"
                strokeWidth={2}
                name="activated"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded bg-muted-foreground inline-block" />
            Total importați
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded bg-primary inline-block" />
            Conturi activate
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdoptionTrendChart;
