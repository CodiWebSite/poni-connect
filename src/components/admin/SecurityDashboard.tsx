import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Shield, ShieldAlert, AlertTriangle, Users, Globe, Clock,
  RefreshCw, Loader2, Eye, CheckCircle2, Monitor
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  details: any;
  acknowledged: boolean;
  created_at: string;
}

interface FailedLoginStat {
  ip_address: string;
  count: number;
}

const eventTypeLabels: Record<string, string> = {
  login_suspect: 'Login suspect',
  new_device: 'Dispozitiv nou',
  new_ip: 'IP nou',
  failed_login: 'Login eșuat',
  role_change: 'Schimbare rol',
  critical_action: 'Acțiune critică',
  logout_all: 'Logout global',
  suspicious_login: 'Login suspect',
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800',
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
};

export default function SecurityDashboard() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    failedLogins24h: 0,
    newDevices24h: 0,
    unacknowledged: 0,
    suspiciousIPs: [] as FailedLoginStat[],
  });

  const fetchData = useCallback(async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [eventsRes, failedRes, newDeviceRes] = await Promise.all([
      supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('auth_login_logs')
        .select('ip_address')
        .eq('status', 'failed')
        .gte('login_at', yesterday),
      supabase
        .from('security_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'new_device')
        .gte('created_at', yesterday),
    ]);

    const allEvents = (eventsRes.data || []) as SecurityEvent[];
    setEvents(allEvents);

    // Count suspicious IPs
    const ipCounts: Record<string, number> = {};
    (failedRes.data || []).forEach((r: any) => {
      const ip = r.ip_address || 'unknown';
      ipCounts[ip] = (ipCounts[ip] || 0) + 1;
    });
    const suspiciousIPs = Object.entries(ipCounts)
      .map(([ip_address, count]) => ({ ip_address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setStats({
      failedLogins24h: failedRes.data?.length || 0,
      newDevices24h: newDeviceRes.count || 0,
      unacknowledged: allEvents.filter(e => !e.acknowledged && e.severity !== 'info').length,
      suspiciousIPs,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    // Realtime subscription
    const channel = supabase
      .channel('security-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_events' }, () => {
        fetchData();
      })
      .subscribe();

    // Auto-refresh every 30s
    const interval = setInterval(fetchData, 30_000);
    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [fetchData]);

  const acknowledgeEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('security_events')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', eventId);
    if (!error) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, acknowledged: true } : e));
      setStats(prev => ({ ...prev, unacknowledged: Math.max(0, prev.unacknowledged - 1) }));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-destructive/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failedLogins24h}</p>
                <p className="text-xs text-muted-foreground">Login-uri eșuate (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Monitor className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.newDevices24h}</p>
                <p className="text-xs text-muted-foreground">Dispozitive noi (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unacknowledged}</p>
                <p className="text-xs text-muted-foreground">Alerte neinvestigate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Globe className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.suspiciousIPs.length}</p>
                <p className="text-xs text-muted-foreground">IP-uri suspecte</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Events */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Evenimente de securitate
              </CardTitle>
              <CardDescription>Monitorizare în timp real</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Niciun eveniment de securitate.</p>
                </div>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      !event.acknowledged && event.severity !== 'info'
                        ? severityColors[event.severity] || ''
                        : 'border-border/50 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {eventTypeLabels[event.event_type] || event.event_type}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          {event.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {event.details?.message || event.details?.action || ''}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(event.created_at), 'dd MMM HH:mm', { locale: ro })}
                        {event.ip_address && (
                          <>
                            <span>·</span>
                            <span>{event.ip_address}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!event.acknowledged && event.severity !== 'info' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => acknowledgeEvent(event.id)}
                        title="Marchează ca investigat"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Suspicious IPs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Top IP-uri suspecte
            </CardTitle>
            <CardDescription>Login-uri eșuate în ultimele 24h</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.suspiciousIPs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Niciun IP suspect.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.suspiciousIPs.map((ip, i) => (
                  <div
                    key={ip.ip_address}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm font-mono">{ip.ip_address}</span>
                    </div>
                    <Badge
                      variant={ip.count >= 5 ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {ip.count}×
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
