import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield, AlertTriangle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
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
  user_name?: string;
}

const PAGE_SIZE = 20;

const AuthLoginLog = () => {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSuspicious, setFilterSuspicious] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProfiles();
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
      </CardContent>
    </Card>
  );
};

export default AuthLoginLog;
