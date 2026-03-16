import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Activity, Users, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { ro } from 'date-fns/locale';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(40, 80%, 55%)',
  'hsl(340, 65%, 50%)',
  'hsl(270, 55%, 55%)',
  'hsl(190, 60%, 45%)',
];

interface ModuleStat { page: string; count: number }
interface DailyStat { date: string; count: number }
interface ActionStat { action: string; count: number }

const AnalyticsWidget = () => {
  const [loading, setLoading] = useState(true);
  const [moduleStats, setModuleStats] = useState<ModuleStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [actionStats, setActionStats] = useState<ActionStat[]>([]);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [totalViews, setTotalViews] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();

    // Fetch ALL events from last 30 days with pagination (1000 per page)
    let allEvents: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allEvents = allEvents.concat(batch);
        if (batch.length < pageSize) hasMore = false;
        page++;
      }
    }

    const events = allEvents;
    if (events.length === 0) { setLoading(false); return; }

    // Module stats (page views)
    const pageViews = events.filter(e => e.event_type === 'page_view');
    const pageCounts: Record<string, number> = {};
    pageViews.forEach(e => { pageCounts[e.page] = (pageCounts[e.page] || 0) + 1; });
    const sortedModules = Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    setModuleStats(sortedModules);

    // Daily active users (last 7 days)
    const dailyMap: Record<string, Set<string>> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyMap[d] = new Set();
    }
    events.forEach(e => {
      const d = e.created_at.slice(0, 10);
      if (dailyMap[d]) dailyMap[d].add(e.user_id);
    });
    setDailyStats(
      Object.entries(dailyMap).map(([date, users]) => ({
        date: format(new Date(date), 'EEE', { locale: ro }),
        count: users.size,
      }))
    );

    // Action stats
    const actions = events.filter(e => e.event_type === 'action');
    const actionCounts: Record<string, number> = {};
    actions.forEach(e => { if (e.action) actionCounts[e.action] = (actionCounts[e.action] || 0) + 1; });
    setActionStats(
      Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    );

    // Unique users last 7 days
    const recentEvents = events.filter(e => e.created_at >= sevenDaysAgo);
    const uniqueSet = new Set(recentEvents.map(e => e.user_id));
    setUniqueUsers(uniqueSet.size);
    setTotalViews(pageViews.length);

    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Analytics de adopție
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border p-3 text-center">
            <Users className="w-4 h-4 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{uniqueUsers}</div>
            <div className="text-xs text-muted-foreground">Utilizatori activi (7z)</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Activity className="w-4 h-4 mx-auto text-accent mb-1" />
            <div className="text-xl font-bold">{totalViews}</div>
            <div className="text-xs text-muted-foreground">Vizualizări (30z)</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <BarChart3 className="w-4 h-4 mx-auto text-info mb-1" />
            <div className="text-xl font-bold">{moduleStats.length}</div>
            <div className="text-xs text-muted-foreground">Module utilizate</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-green-500 mb-1" />
            <div className="text-xl font-bold">{actionStats.length}</div>
            <div className="text-xs text-muted-foreground">Tipuri de acțiuni</div>
          </div>
        </div>

        <Tabs defaultValue="modules" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="modules">Module populare</TabsTrigger>
            <TabsTrigger value="daily">Utilizatori zilnici</TabsTrigger>
            <TabsTrigger value="actions">Acțiuni frecvente</TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="mt-3">
            {moduleStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu există date încă.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={moduleStats}
                      dataKey="count"
                      nameKey="page"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ page, count }) => `${page}: ${count}`}
                      labelLine={false}
                    >
                      {moduleStats.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="daily" className="mt-3">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v} utilizatori`, 'Activi']} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="mt-3">
            {actionStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu au fost înregistrate acțiuni încă.</p>
            ) : (
              <div className="space-y-2">
                {actionStats.map((a, i) => (
                  <div key={a.action} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{a.action}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(20, (a.count / (actionStats[0]?.count || 1)) * 120)}px`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                      <span className="text-muted-foreground w-8 text-right">{a.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AnalyticsWidget;
