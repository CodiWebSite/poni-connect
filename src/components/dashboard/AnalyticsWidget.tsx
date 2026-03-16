import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Activity, Users, TrendingUp, Loader2, Crown, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfYear } from 'date-fns';
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

type PeriodKey = '7d' | '30d' | '90d' | 'year';

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: '7d', label: 'Ultimele 7 zile' },
  { value: '30d', label: 'Ultimele 30 zile' },
  { value: '90d', label: 'Ultimele 90 zile' },
  { value: 'year', label: 'An curent' },
];

function getPeriodStart(period: PeriodKey): Date {
  if (period === '7d') return subDays(new Date(), 7);
  if (period === '30d') return subDays(new Date(), 30);
  if (period === '90d') return subDays(new Date(), 90);
  return startOfYear(new Date());
}

interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: string;
  page: string;
  action: string | null;
  created_at: string;
  metadata: any;
}

interface Profile {
  user_id: string;
  full_name: string;
  department: string | null;
  avatar_url: string | null;
}

const AnalyticsWidget = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const since = getPeriodStart(period).toISOString();

    // Fetch events with pagination + profiles in parallel
    const eventsPromise = fetchAllEvents(since);
    const profilesPromise = supabase.from('profiles').select('user_id, full_name, department, avatar_url');

    const [allEvents, { data: profileData }] = await Promise.all([eventsPromise, profilesPromise]);

    setEvents(allEvents);
    setProfiles(profileData || []);
    setLoading(false);
  };

  const fetchAllEvents = async (since: string): Promise<AnalyticsEvent[]> => {
    let all: AnalyticsEvent[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        all = all.concat(batch);
        if (batch.length < pageSize) hasMore = false;
        page++;
      }
    }
    return all;
  };

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach(p => { map[p.user_id] = p; });
    return map;
  }, [profiles]);

  // === Computed stats ===
  const { moduleStats, dailyStats, actionStats, uniqueUsers, totalViews, topUsers, departmentStats } = useMemo(() => {
    const pageViews = events.filter(e => e.event_type === 'page_view');
    const actions = events.filter(e => e.event_type === 'action');

    // Module stats
    const pageCounts: Record<string, number> = {};
    pageViews.forEach(e => { pageCounts[e.page] = (pageCounts[e.page] || 0) + 1; });
    const moduleStats = Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Daily active users (last 7 days of period)
    const dailyMap: Record<string, Set<string>> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyMap[d] = new Set();
    }
    events.forEach(e => {
      const d = e.created_at.slice(0, 10);
      if (dailyMap[d]) dailyMap[d].add(e.user_id);
    });
    const dailyStats = Object.entries(dailyMap).map(([date, users]) => ({
      date: format(new Date(date), 'EEE', { locale: ro }),
      count: users.size,
    }));

    // Action stats
    const actionCounts: Record<string, number> = {};
    actions.forEach(e => { if (e.action) actionCounts[e.action] = (actionCounts[e.action] || 0) + 1; });
    const actionStats = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Unique users & total views
    const uniqueSet = new Set(events.map(e => e.user_id));
    const uniqueUsers = uniqueSet.size;
    const totalViews = pageViews.length;

    // Top active users
    const userCounts: Record<string, number> = {};
    events.forEach(e => { userCounts[e.user_id] = (userCounts[e.user_id] || 0) + 1; });
    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({
        userId,
        name: profileMap[userId]?.full_name || 'Necunoscut',
        department: profileMap[userId]?.department || '—',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Department stats
    const deptCounts: Record<string, { events: number; users: Set<string> }> = {};
    events.forEach(e => {
      const dept = profileMap[e.user_id]?.department || 'Fără departament';
      if (!deptCounts[dept]) deptCounts[dept] = { events: 0, users: new Set() };
      deptCounts[dept].events++;
      deptCounts[dept].users.add(e.user_id);
    });
    const departmentStats = Object.entries(deptCounts)
      .map(([dept, data]) => ({ department: dept, events: data.events, users: data.users.size }))
      .sort((a, b) => b.events - a.events);

    return { moduleStats, dailyStats, actionStats, uniqueUsers, totalViews, topUsers, departmentStats };
  }, [events, profileMap]);

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Analytics de adopție
          </CardTitle>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border p-3 text-center">
            <Users className="w-4 h-4 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold">{uniqueUsers}</div>
            <div className="text-xs text-muted-foreground">Utilizatori activi</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Activity className="w-4 h-4 mx-auto text-accent mb-1" />
            <div className="text-xl font-bold">{totalViews.toLocaleString('ro-RO')}</div>
            <div className="text-xs text-muted-foreground">Vizualizări</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Building2 className="w-4 h-4 mx-auto text-info mb-1" />
            <div className="text-xl font-bold">{departmentStats.length}</div>
            <div className="text-xs text-muted-foreground">Departamente active</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-green-500 mb-1" />
            <div className="text-xl font-bold">{events.length.toLocaleString('ro-RO')}</div>
            <div className="text-xs text-muted-foreground">Total evenimente</div>
          </div>
        </div>

        <Tabs defaultValue="modules" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="modules" className="text-xs">Module</TabsTrigger>
            <TabsTrigger value="daily" className="text-xs">Zilnic</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Acțiuni</TabsTrigger>
            <TabsTrigger value="top-users" className="text-xs">Top utilizatori</TabsTrigger>
            <TabsTrigger value="departments" className="text-xs">Departamente</TabsTrigger>
          </TabsList>

          {/* Module stats */}
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

          {/* Daily active users */}
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

          {/* Action stats */}
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

          {/* Top users */}
          <TabsContent value="top-users" className="mt-3">
            {topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu există date încă.</p>
            ) : (
              <div className="space-y-2">
                {topUsers.map((u, i) => (
                  <div key={u.userId} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {i === 0 ? <Crown className="w-3.5 h-3.5 text-yellow-500" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.department}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className="h-2 rounded-full bg-primary/70"
                        style={{ width: `${Math.max(16, (u.count / (topUsers[0]?.count || 1)) * 80)}px` }}
                      />
                      <span className="text-muted-foreground text-xs w-10 text-right">{u.count.toLocaleString('ro-RO')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Department stats */}
          <TabsContent value="departments" className="mt-3">
            {departmentStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu există date încă.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentStats.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="department"
                      tick={{ fontSize: 10 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value.toLocaleString('ro-RO'),
                        name === 'events' ? 'Evenimente' : 'Utilizatori',
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="events" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="events" />
                    <Bar dataKey="users" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="users" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-2 rounded-sm bg-primary inline-block" />
                    Evenimente
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-2 rounded-sm bg-accent inline-block" />
                    Utilizatori unici
                  </span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AnalyticsWidget;
