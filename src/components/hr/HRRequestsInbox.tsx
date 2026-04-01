import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CorrectionRequestsManager } from '@/components/hr/CorrectionRequestsManager';
import { Inbox, FileText, MessageSquare, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HRRequest {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  created_at: string;
  details: any;
  approver_id: string | null;
  user_name?: string;
}

export default function HRRequestsInbox() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase.from('hr_requests').select('*').eq('request_type', 'adeverinta').order('created_at', { ascending: false });
    
    // Get user names
    const userIds = [...new Set((data || []).map(r => r.user_id))];
    let nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      (profiles || []).forEach(p => { nameMap[p.user_id] = p.full_name; });
    }

    setRequests((data || []).map(r => ({ ...r, user_name: nameMap[r.user_id] || 'Necunoscut' })));
    setLoading(false);
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    const { error } = await supabase.from('hr_requests').update({ status, approver_id: user?.id, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut actualiza cererea.', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: `Cererea a fost ${status === 'approved' ? 'aprobată' : 'respinsă'}.` });
      fetchRequests();
    }
    setProcessing(null);
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="text-xs bg-amber-500 text-white"><Clock className="w-3 h-3 mr-1" />În așteptare</Badge>;
      case 'approved': return <Badge className="text-xs bg-emerald-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Aprobat</Badge>;
      case 'rejected': return <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 mr-1" />Respins</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="adeverinte">
        <TabsList>
          <TabsTrigger value="adeverinte" className="gap-2"><FileText className="w-4 h-4" />Cereri Adeverințe</TabsTrigger>
          <TabsTrigger value="corrections" className="gap-2"><MessageSquare className="w-4 h-4" />Cereri Corecție Date</TabsTrigger>
        </TabsList>

        <TabsContent value="adeverinte" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="pending">În așteptare</SelectItem>
                <SelectItem value="approved">Aprobate</SelectItem>
                <SelectItem value="rejected">Respinse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Inbox className="w-4 h-4 text-primary" />Inbox Cereri Adeverințe ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><Inbox className="w-12 h-12 mx-auto mb-4 opacity-40" /><p>Nu sunt cereri în această categorie.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Solicitant</TableHead>
                        <TableHead>Tip</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(req => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.user_name}</TableCell>
                          <TableCell>Adeverință</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(req.created_at), 'dd.MM.yyyy HH:mm', { locale: ro })}</TableCell>
                          <TableCell>{statusBadge(req.status)}</TableCell>
                          <TableCell>
                            {req.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => updateStatus(req.id, 'approved')} disabled={processing === req.id}>
                                  {processing === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}Aprobă
                                </Button>
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(req.id, 'rejected')} disabled={processing === req.id}>
                                  <XCircle className="w-3 h-3 mr-1" />Respinge
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corrections" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" />Cereri Corecție Date Personale</CardTitle>
            </CardHeader>
            <CardContent>
              <CorrectionRequestsManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
