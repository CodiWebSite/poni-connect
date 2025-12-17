import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Calendar, Clock, User, Phone, Mail, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

type AudienceStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface Audience {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  duration_minutes: number;
  host_id: string;
  requester_name: string;
  requester_organization: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  status: AudienceStatus;
  notes: string | null;
  created_at: string;
}

interface Host {
  user_id: string;
  full_name: string;
  position: string | null;
}

const statusConfig: Record<AudienceStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'În așteptare', variant: 'secondary' },
  confirmed: { label: 'Confirmat', variant: 'default' },
  completed: { label: 'Finalizat', variant: 'outline' },
  cancelled: { label: 'Anulat', variant: 'destructive' }
};

const AudienceScheduler = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '09:00',
    duration_minutes: 30,
    host_id: '',
    requester_name: '',
    requester_organization: '',
    requester_phone: '',
    requester_email: '',
    notes: ''
  });

  const { data: hosts } = useQuery({
    queryKey: ['audience-hosts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, position')
        .not('position', 'is', null);
      
      if (error) throw error;
      return data as Host[];
    }
  });

  const { data: audiences, isLoading } = useQuery({
    queryKey: ['audiences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audiences')
        .select('*')
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      return data as Audience[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const scheduledDateTime = `${data.scheduled_date}T${data.scheduled_time}:00`;
      
      const { error } = await supabase
        .from('audiences')
        .insert({
          title: data.title,
          description: data.description || null,
          scheduled_date: scheduledDateTime,
          duration_minutes: data.duration_minutes,
          host_id: data.host_id,
          requester_name: data.requester_name,
          requester_organization: data.requester_organization || null,
          requester_phone: data.requester_phone || null,
          requester_email: data.requester_email || null,
          notes: data.notes || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiences'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Audiență programată cu succes');
    },
    onError: (error) => {
      toast.error('Eroare la programare: ' + error.message);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AudienceStatus }) => {
      const { error } = await supabase
        .from('audiences')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiences'] });
      toast.success('Status actualizat');
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      scheduled_date: '',
      scheduled_time: '09:00',
      duration_minutes: 30,
      host_id: '',
      requester_name: '',
      requester_organization: '',
      requester_phone: '',
      requester_email: '',
      notes: ''
    });
  };

  const filteredAudiences = audiences?.filter(a => 
    filterStatus === 'all' || a.status === filterStatus
  );

  const getHostName = (hostId: string) => {
    const host = hosts?.find(h => h.user_id === hostId);
    return host ? host.full_name : 'Necunoscut';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Programări Audiențe
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Programare Nouă
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Programare Audiență</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Titlu *</Label>
                <Input 
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Subiectul audienței"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input 
                    type="date" 
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ora *</Label>
                  <Input 
                    type="time" 
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Durată (minute)</Label>
                  <Select 
                    value={String(formData.duration_minutes)} 
                    onValueChange={(v) => setFormData({ ...formData, duration_minutes: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">1 oră</SelectItem>
                      <SelectItem value="90">1.5 ore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gazdă *</Label>
                  <Select 
                    value={formData.host_id} 
                    onValueChange={(v) => setFormData({ ...formData, host_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectează" />
                    </SelectTrigger>
                    <SelectContent>
                      {hosts?.map(host => (
                        <SelectItem key={host.user_id} value={host.user_id}>
                          {host.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nume solicitant *</Label>
                <Input 
                  value={formData.requester_name}
                  onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                  placeholder="Numele persoanei"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Organizație</Label>
                <Input 
                  value={formData.requester_organization}
                  onChange={(e) => setFormData({ ...formData, requester_organization: e.target.value })}
                  placeholder="Instituție / Companie"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input 
                    value={formData.requester_phone}
                    onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
                    placeholder="0700 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={formData.requester_email}
                    onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
                    placeholder="email@exemplu.ro"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descriere</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalii despre audiență..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Anulează
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Se salvează...' : 'Programează'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrează după status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate</SelectItem>
              <SelectItem value="pending">În așteptare</SelectItem>
              <SelectItem value="confirmed">Confirmate</SelectItem>
              <SelectItem value="completed">Finalizate</SelectItem>
              <SelectItem value="cancelled">Anulate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data & Ora</TableHead>
                  <TableHead>Titlu</TableHead>
                  <TableHead>Gazdă</TableHead>
                  <TableHead>Solicitant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudiences?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nu există audiențe programate
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAudiences?.map((audience) => (
                    <TableRow key={audience.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(audience.scheduled_date), 'dd MMM yyyy', { locale: ro })}
                          </span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(audience.scheduled_date), 'HH:mm')}
                            {' '}({audience.duration_minutes} min)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {audience.title}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {getHostName(audience.host_id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{audience.requester_name}</span>
                          {audience.requester_organization && (
                            <span className="text-xs text-muted-foreground">
                              {audience.requester_organization}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[audience.status].variant}>
                          {statusConfig[audience.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {audience.status === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-green-600"
                                onClick={() => updateStatusMutation.mutate({ id: audience.id, status: 'confirmed' })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-red-600"
                                onClick={() => updateStatusMutation.mutate({ id: audience.id, status: 'cancelled' })}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {audience.status === 'confirmed' && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => updateStatusMutation.mutate({ id: audience.id, status: 'completed' })}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Finalizează
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudienceScheduler;
