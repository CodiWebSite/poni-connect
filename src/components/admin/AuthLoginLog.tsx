import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, AlertTriangle, Search, ChevronLeft, ChevronRight, Users, Globe, Monitor, Crown, Activity } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { ro } from 'date-fns/locale';

interface AuthLog {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_summary: string | null;
  login_at: string;
  status: string;
  is_suspicious: boolean;
}

const PAGE_SIZE = 20;

const AuthLoginLog = () => {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [allLogs, setAllLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSuspicious, setFilterSuspicious] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProfiles();
    fetchAllLogsForStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, filterSuspicious]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
  };

  const fetchAllLogsForStats = async () => {
    let all: AuthLog[] = [];
    let p = 0;
    const size = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: batch } = await supabase
        .from('auth_login_logs')
        .select('*')
        .order('login_at', { ascending: false })
        .range(p * size, (p + 1) * size - 1);
      if (!batch || batch.length === 0) { hasMore = false; }
      else {
        all = all.concat(batch);
        if (batch.length < size) hasMore = false;
        p++;
      }
    }
    setAllLogs(all);
  };

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('auth_login_logs')
      .select('*', { count: 'exact' })
      .order('login_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterSuspicious === 'suspicious') {
      query = query.eq('is_suspicious', true);
    }

    const { data, count, error } = await query;
    if (!error && data) {
      setLogs(data);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const userName = profiles[log.user_id] || '';
    const q = searchQuery.toLowerCase();
    return (
      userName.toLowerCase().includes(q) ||
      log.ip_address?.toLowerCase().includes(q) ||
      log.device_summary?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // === Computed stats from allLogs ===
  const stats = useMemo(() => {
    if (allLogs.length === 0) return null;

    const totalLogins = allLogs.length;
    const suspiciousCount = allLogs.filter(l => l.is_suspicious).length;
    const uniqueUsers = new Set(allLogs.map(l => l.user_id)).size;
    const today = startOfDay(new Date()).toISOString();
    const todayLogins = allLogs.filter(l => l.login_at >= today).length;
    const last7d = subDays(new Date(), 7).toISOString();
    const last7dLogins = allLogs.filter(l => l.login_at >= last7d).length;

    // Top IPs
    const ipCounts: Record<string, { count: number; users: Set<string> }> = {};
    allLogs.forEach(l => {
      const ip = l.ip_address || 'unknown';
      if (!ipCounts[ip]) ipCounts[ip] = { count: 0, users: new Set() };
      ipCounts[ip].count++;
      ipCounts[ip].users.add(l.user_id);
    });
    const topIPs = Object.entries(ipCounts)
      .map(([ip, d]) => ({ ip, count: d.count, users: d.users.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top devices
    const deviceCounts: Record<string, number> = {};
    allLogs.forEach(l => {
      const dev = l.device_summary || 'Necunoscut';
      deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
    });
    const topDevices = Object.entries(deviceCounts)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);

    // Top users
    const userCounts: Record<string, { count: number; suspicious: number; lastLogin: string }> = {};
    allLogs.forEach(l => {
      if (!userCounts[l.user_id]) userCounts[l.user_id] = { count: 0, suspicious: 0, lastLogin: l.login_at };
      userCounts[l.user_id].count++;
      if (l.is_suspicious) userCounts[l.user_id].suspicious++;
      if (l.login_at > userCounts[l.user_id].lastLogin) userCounts[l.user_id].lastLogin = l.login_at;
    });
    const topUsers = Object.entries(userCounts)
      .map(([userId, d]) => ({ userId, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return { totalLogins, suspiciousCount, uniqueUsers, todayLogins, last7dLogins, topIPs, topDevices, topUsers };
  }, [allLogs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Jurnal Autentificări
        </CardTitle>
        <CardDescription>Log-ul tuturor autentificărilor din sistem</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <Activity className="w-4 h-4 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold">{stats.totalLogins}</div>
              <div className="text-xs text-muted-foreground">Total login-uri</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <AlertTriangle className="w-4 h-4 mx-auto text-destructive mb-1" />
              <div className="text-xl font-bold text-destructive">{stats.suspiciousCount}</div>
              <div className="text-xs text-muted-foreground">Suspecte</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Users className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <div className="text-xl font-bold">{stats.uniqueUsers}</div>
              <div className="text-xs text-muted-foreground">Utilizatori unici</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Shield className="w-4 h-4 mx-auto text-green-500 mb-1" />
              <div className="text-xl font-bold">{stats.todayLogins}</div>
              <div className="text-xs text-muted-foreground">Azi</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Activity className="w-4 h-4 mx-auto text-accent mb-1" />
              <div className="text-xl font-bold">{stats.last7dLogins}</div>
              <div className="text-xs text-muted-foreground">Ultimele 7 zile</div>
            </div>
          </div>
        )}

        <Tabs defaultValue="log" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="log" className="text-xs">Jurnal</TabsTrigger>
            <TabsTrigger value="top-users" className="text-xs">Top Utilizatori</TabsTrigger>
            <TabsTrigger value="top-ips" className="text-xs">Top IP-uri</TabsTrigger>
            <TabsTrigger value="devices" className="text-xs">Dispozitive</TabsTrigger>
          </TabsList>

          {/* === Main Log Tab === */}
          <TabsContent value="log" className="mt-3 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Caută după utilizator, IP, dispozitiv..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterSuspicious} onValueChange={(v) => { setFilterSuspicious(v); setPage(0); }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate</SelectItem>
                  <SelectItem value="suspicious">Doar suspecte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nu există înregistrări.
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Ora</TableHead>
                        <TableHead>Utilizator</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Dispozitiv</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Suspect</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id} className={log.is_suspicious ? 'bg-destructive/5' : ''}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(log.login_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {profiles[log.user_id] || 'Necunoscut'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ip_address || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.device_summary || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                              {log.status === 'success' ? 'Reușit' : 'Eșuat'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {log.is_suspicious && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Suspect
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Pagina {page + 1} din {totalPages} ({totalCount} înregistrări)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* === Top Users Tab === */}
          <TabsContent value="top-users" className="mt-3">
            {!stats || stats.topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu există date.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.topUsers.map((u, i) => (
                  <div key={u.userId} className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {i === 0 ? <Crown className="w-4 h-4 text-yellow-500" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{profiles[u.userId] || 'Necunoscut'}</div>
                      <div className="text-xs text-muted-foreground">
                        Ultimul login: {format(new Date(u.lastLogin), 'dd MMM, HH:mm', { locale: ro })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {u.suspicious > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {u.suspicious}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2 rounded-full bg-primary/70"
                          style={{ width: `${Math.max(16, (u.count / (stats.topUsers[0]?.count || 1)) * 80)}px` }}
                        />
                        <span className="text-muted-foreground text-xs w-8 text-right font-mono">{u.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === Top IPs Tab === */}
          <TabsContent value="top-ips" className="mt-3">
            {!stats || stats.topIPs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu există date.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Adresă IP</TableHead>
                      <TableHead className="text-center">Login-uri</TableHead>
                      <TableHead className="text-center">Utilizatori unici</TableHead>
                      <TableHead>Tip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topIPs.map((ip, i) => {
                      const isInternal = ip.ip.startsWith('193.138.98.');
                      return (
                        <TableRow key={ip.ip}>
                          <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono text-sm">{ip.ip}</TableCell>
                          <TableCell className="text-center font-semibold">{ip.count}</TableCell>
                          <TableCell className="text-center">{ip.users}</TableCell>
                          <TableCell>
                            <Badge variant={isInternal ? 'secondary' : 'outline'} className="text-xs gap-1">
                              <Globe className="w-3 h-3" />
                              {isInternal ? 'Intern' : 'Extern'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* === Devices Tab === */}
          <TabsContent value="devices" className="mt-3">
            {!stats || stats.topDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nu există date.</p>
            ) : (
              <div className="space-y-2">
                {stats.topDevices.map((d, i) => {
                  const pct = stats.totalLogins > 0 ? ((d.count / stats.totalLogins) * 100).toFixed(1) : '0';
                  return (
                    <div key={d.device} className="flex items-center gap-3 text-sm">
                      <Monitor className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-foreground">{d.device}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(d.count / (stats.topDevices[0]?.count || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs w-16 text-right">
                          {d.count} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AuthLoginLog;
