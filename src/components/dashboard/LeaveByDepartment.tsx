import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DeptData {
  department: string;
  shortName: string;
  totalDays: number;
  usedDays: number;
  usagePercent: number;
  employeeCount: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(30, 80%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(350, 65%, 55%)',
  'hsl(190, 70%, 45%)',
  'hsl(45, 75%, 50%)',
];

const LeaveByDepartment = () => {
  const [data, setData] = useState<DeptData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: employees } = await supabase
      .from('employee_personal_data')
      .select('department, total_leave_days, used_leave_days, employee_record_id')
      .eq('is_archived', false);

    // Also get data from employee_records for those with accounts
    const { data: records } = await supabase
      .from('employee_records')
      .select('id, total_leave_days, used_leave_days');

    const recordMap: Record<string, { total: number; used: number }> = {};
    (records || []).forEach(r => {
      recordMap[r.id] = { total: r.total_leave_days, used: r.used_leave_days };
    });

    // Group by department
    const deptMap: Record<string, { total: number; used: number; count: number }> = {};

    (employees || []).forEach(e => {
      const dept = e.department || 'Nespecificat';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, used: 0, count: 0 };

      const rec = e.employee_record_id ? recordMap[e.employee_record_id] : null;
      const total = rec?.total ?? e.total_leave_days ?? 21;
      const used = rec?.used ?? e.used_leave_days ?? 0;

      deptMap[dept].total += total;
      deptMap[dept].used += used;
      deptMap[dept].count++;
    });

    const chartData: DeptData[] = Object.entries(deptMap)
      .map(([dept, vals]) => ({
        department: dept,
        shortName: dept.length > 15 ? dept.substring(0, 14) + '…' : dept,
        totalDays: vals.total,
        usedDays: vals.used,
        usagePercent: vals.total > 0 ? Math.round((vals.used / vals.total) * 100) : 0,
        employeeCount: vals.count,
      }))
      .sort((a, b) => b.usagePercent - a.usagePercent);

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
          Nu există date de concediu.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Utilizare concediu per departament
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, _name: string, props: any) => {
                  const item = props.payload as DeptData;
                  return [
                    `${value}% (${item.usedDays}/${item.totalDays} zile)`,
                    `${item.department} (${item.employeeCount} ang.)`,
                  ];
                }}
                labelFormatter={() => ''}
              />
              <Bar dataKey="usagePercent" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaveByDepartment;
