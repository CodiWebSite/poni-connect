import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Calendar, Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ro } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const SecretariatDashboard = () => {
  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: registryStats } = useQuery({
    queryKey: ['registry-stats', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_registry')
        .select('direction, resolved_at, created_at')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd + 'T23:59:59');
      
      if (error) throw error;
      
      const incoming = data.filter(d => d.direction === 'incoming').length;
      const outgoing = data.filter(d => d.direction === 'outgoing').length;
      const resolved = data.filter(d => d.resolved_at).length;
      const pending = data.filter(d => !d.resolved_at).length;
      
      return { total: data.length, incoming, outgoing, resolved, pending };
    }
  });

  const { data: audienceStats } = useQuery({
    queryKey: ['audience-stats', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audiences')
        .select('status, scheduled_date')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd + 'T23:59:59');
      
      if (error) throw error;
      
      return {
        total: data.length,
        pending: data.filter(a => a.status === 'pending').length,
        confirmed: data.filter(a => a.status === 'confirmed').length,
        completed: data.filter(a => a.status === 'completed').length,
        cancelled: data.filter(a => a.status === 'cancelled').length
      };
    }
  });

  const { data: visitorStats } = useQuery({
    queryKey: ['visitor-stats', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('status, expected_date')
        .gte('expected_date', monthStart)
        .lte('expected_date', monthEnd);
      
      if (error) throw error;
      
      return {
        total: data.length,
        expected: data.filter(v => v.status === 'expected').length,
        checkedIn: data.filter(v => v.status === 'checked_in').length,
        checkedOut: data.filter(v => v.status === 'checked_out').length
      };
    }
  });

  const { data: weeklyData } = useQuery({
    queryKey: ['weekly-registry', weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_registry')
        .select('direction, created_at')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59');
      
      if (error) throw error;
      
      const days = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin'];
      const grouped = days.map((day, index) => {
        const dayDocs = data.filter(d => new Date(d.created_at).getDay() === index + 1);
        return {
          name: day,
          intrări: dayDocs.filter(d => d.direction === 'incoming').length,
          ieșiri: dayDocs.filter(d => d.direction === 'outgoing').length
        };
      });
      
      return grouped;
    }
  });

  const docTypeData = [
    { name: 'Intrări', value: registryStats?.incoming || 0 },
    { name: 'Ieșiri', value: registryStats?.outgoing || 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documente Luna Aceasta</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registryStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {registryStats?.incoming || 0} intrări, {registryStats?.outgoing || 0} ieșiri
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documente Nerezolvate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{registryStats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              {registryStats?.resolved || 0} rezolvate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audiențe Programate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audienceStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {audienceStats?.confirmed || 0} confirmate, {audienceStats?.pending || 0} în așteptare
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vizitatori Luna Aceasta</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visitorStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {visitorStats?.checkedOut || 0} finalizate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registratură Săptămânală</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="intrări" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ieșiri" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuție Documente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={docTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {docTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rezumat {format(today, 'MMMM yyyy', { locale: ro })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-primary">{registryStats?.resolved || 0}</div>
              <div className="text-sm text-muted-foreground">Documente Rezolvate</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{audienceStats?.completed || 0}</div>
              <div className="text-sm text-muted-foreground">Audiențe Finalizate</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{visitorStats?.checkedOut || 0}</div>
              <div className="text-sm text-muted-foreground">Vizite Complete</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-amber-600">{audienceStats?.cancelled || 0}</div>
              <div className="text-sm text-muted-foreground">Audiențe Anulate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecretariatDashboard;
