import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, History, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  role_change: 'Schimbare rol',
  user_delete: 'Ștergere cont',
  employee_edit: 'Editare angajat',
  leave_approve: 'Aprobare concediu',
  leave_reject: 'Respingere concediu',
  request_approve: 'Aprobare cerere',
  request_reject: 'Respingere cerere',
  manual_leave: 'Concediu manual',
  document_upload: 'Încărcare document',
  document_delete: 'Ștergere document',
};

const actionColors: Record<string, string> = {
  role_change: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  user_delete: 'bg-destructive/10 text-destructive border-destructive/20',
  employee_edit: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  leave_approve: 'bg-green-500/10 text-green-600 border-green-500/20',
  leave_reject: 'bg-red-500/10 text-red-600 border-red-500/20',
  request_approve: 'bg-green-500/10 text-green-600 border-green-500/20',
  request_reject: 'bg-red-500/10 text-red-600 border-red-500/20',
  manual_leave: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  document_upload: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  document_delete: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const PAGE_SIZE = 20;

const AuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchEntries();
  }, [page, actionFilter]);

  const fetchEntries = async () => {
    setLoading(true);

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      setLoading(false);
      return;
    }

    setEntries((data as AuditEntry[]) || []);
    setTotalCount(count || 0);

    // Fetch user names for all unique user_ids
    const userIds = [...new Set((data || []).map((e: any) => e.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profiles) {
        const names: Record<string, string> = {};
        profiles.forEach(p => { names[p.user_id] = p.full_name; });
        setUserNames(prev => ({ ...prev, ...names }));
      }
    }

    setLoading(false);
  };

  const formatDetails = (entry: AuditEntry): string => {
    const d = entry.details;
    if (!d || Object.keys(d).length === 0) return '-';

    if (entry.action === 'role_change') {
      return `${d.user_name || ''}: ${d.old_role || '?'} → ${d.new_role || '?'}`;
    }
    if (entry.action === 'user_delete') {
      return `Cont șters: ${d.deleted_user_name || d.deleted_user_id || '?'}`;
    }
    if (entry.action === 'employee_edit') {
      return `Angajat: ${d.employee_name || '?'}`;
    }
    return JSON.stringify(d).slice(0, 100);
  };

  const filteredEntries = searchQuery
    ? entries.filter(e =>
        (userNames[e.user_id] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (actionLabels[e.action] || e.action).toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatDetails(e).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Jurnal de Audit
        </CardTitle>
        <CardDescription>
          Istoricul acțiunilor administrative din sistem
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Caută în jurnal..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Toate acțiunile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate acțiunile</SelectItem>
              {Object.entries(actionLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nu există înregistrări în jurnal</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Utilizator</TableHead>
                  <TableHead>Acțiune</TableHead>
                  <TableHead>Detalii</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(entry.created_at), 'dd.MM.yyyy HH:mm', { locale: ro })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {userNames[entry.user_id] || entry.user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={actionColors[entry.action] || 'bg-muted text-muted-foreground'}>
                        {actionLabels[entry.action] || entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {formatDetails(entry)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              {totalCount} înregistrări • Pagina {page + 1} din {totalPages}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLog;
