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
import { Inbox, FileText, MessageSquare, CheckCircle, XCircle, Clock, Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateCertificateBuffer, type EmployeeData, type CertificateType } from '@/utils/generateCertificate';

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

  const generateAndSaveCertificate = async (req: HRRequest): Promise<boolean> => {
    try {
      // Get employee personal data by matching user profile name
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', req.user_id)
        .single();

      // Try matching by profile name or direct query
      const { data: epd } = await supabase
        .from('employee_personal_data')
        .select('*')
        .eq('is_archived', false)
        .ilike('email', `%${req.user_id}%`)
        .maybeSingle();

      // Alternative: match by name
      const nameParts = (userProfile?.full_name || '').split(' ');
      let epdData = epd;
      if (!epdData && nameParts.length >= 2) {
        const { data: epdByName } = await supabase
          .from('employee_personal_data')
          .select('*')
          .eq('is_archived', false)
          .ilike('first_name', nameParts[0])
          .ilike('last_name', nameParts.slice(1).join(' '))
          .maybeSingle();
        if (!epdByName) {
          // Try reversed order (last_name first_name)
          const { data: epdReversed } = await supabase
            .from('employee_personal_data')
            .select('*')
            .eq('is_archived', false)
            .ilike('last_name', nameParts[0])
            .ilike('first_name', nameParts.slice(1).join(' '))
            .maybeSingle();
          epdData = epdReversed;
        } else {
          epdData = epdByName;
        }
      }

      if (!epdData) {
        toast({ title: 'Avertisment', description: 'Nu s-au găsit datele angajatului pentru generarea adeverinței. Cererea a fost aprobată fără document.', variant: 'destructive' });
        return false;
      }

      const empData: EmployeeData = {
        full_name: `${epdData.first_name} ${epdData.last_name}`,
        first_name: epdData.first_name,
        last_name: epdData.last_name,
        cnp: epdData.cnp,
        department: epdData.department,
        position: epdData.position,
        grade: epdData.grade,
        employment_date: epdData.employment_date,
        contract_type: epdData.contract_type,
        ci_series: epdData.ci_series,
        ci_number: epdData.ci_number,
        ci_issued_by: epdData.ci_issued_by,
        ci_issued_date: epdData.ci_issued_date,
        address_street: epdData.address_street,
        address_number: epdData.address_number,
        address_block: epdData.address_block,
        address_floor: epdData.address_floor,
        address_apartment: epdData.address_apartment,
        address_city: epdData.address_city,
        address_county: epdData.address_county,
      };

      const purpose = req.details?.details || req.details?.purpose || undefined;
      const { blob, filename } = await generateCertificateBuffer(empData, 'salariat', purpose);

      // Upload to storage
      const storagePath = `${req.user_id}/${Date.now()}_${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(storagePath, blob, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast({ title: 'Avertisment', description: 'Adeverința nu a putut fi salvată în storage, dar cererea a fost aprobată.', variant: 'destructive' });
        return false;
      }

      // Save reference in employee_documents
      const { error: docError } = await supabase.from('employee_documents').insert({
        user_id: req.user_id,
        document_type: 'adeverinta',
        name: filename,
        description: `Adeverință generată automat la aprobarea cererii din ${format(new Date(req.created_at), 'dd.MM.yyyy', { locale: ro })}`,
        file_url: storagePath,
        uploaded_by: user?.id,
      });

      if (docError) {
        console.error('Document record error:', docError);
      }

      // Notify employee
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        title: 'Adeverință aprobată',
        message: 'Adeverința solicitată a fost aprobată și este disponibilă pentru descărcare în Profilul Meu → Documentele Mele.',
        type: 'success',
        related_type: 'hr_request',
        related_id: req.id,
      });

      return true;
    } catch (err) {
      console.error('Certificate generation error:', err);
      return false;
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    const { error } = await supabase.from('hr_requests').update({ status, approver_id: user?.id, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut actualiza cererea.', variant: 'destructive' });
    } else {
      // If approved, generate and save certificate
      if (status === 'approved') {
        const req = requests.find(r => r.id === id);
        if (req) {
          const generated = await generateAndSaveCertificate(req);
          toast({
            title: 'Cerere aprobată',
            description: generated
              ? 'Adeverința a fost generată și salvată în dosarul angajatului.'
              : 'Cererea a fost aprobată. Adeverința poate fi generată manual din Generatorul de Adeverințe.',
          });
        }
      } else {
        toast({ title: 'Succes', description: 'Cererea a fost respinsă.' });
      }
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
