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
import { Plus, Users, LogIn, LogOut, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

type VisitorStatus = 'expected' | 'checked_in' | 'checked_out' | 'cancelled';

interface Visitor {
  id: string;
  full_name: string;
  organization: string | null;
  id_document_type: string | null;
  id_document_number: string | null;
  purpose: string;
  host_name: string;
  host_department: string | null;
  expected_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  badge_number: string | null;
  status: VisitorStatus;
  notes: string | null;
  created_at: string;
}

const statusConfig: Record<VisitorStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  expected: { label: 'Așteptat', variant: 'secondary' },
  checked_in: { label: 'Înregistrat', variant: 'default' },
  checked_out: { label: 'Plecat', variant: 'outline' },
  cancelled: { label: 'Anulat', variant: 'destructive' }
};

const idDocumentTypes = ['CI', 'Pașaport', 'Permis conducere', 'Legitimație'];

const VisitorLog = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [formData, setFormData] = useState({
    full_name: '',
    organization: '',
    id_document_type: '',
    id_document_number: '',
    purpose: '',
    host_name: '',
    host_department: '',
    expected_date: format(new Date(), 'yyyy-MM-dd'),
    badge_number: '',
    notes: ''
  });

  const { data: visitors, isLoading } = useQuery({
    queryKey: ['visitors', filterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('expected_date', filterDate)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Visitor[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('visitors')
        .insert({
          full_name: data.full_name,
          organization: data.organization || null,
          id_document_type: data.id_document_type || null,
          id_document_number: data.id_document_number || null,
          purpose: data.purpose,
          host_name: data.host_name,
          host_department: data.host_department || null,
          expected_date: data.expected_date,
          badge_number: data.badge_number || null,
          notes: data.notes || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Vizitator înregistrat');
    },
    onError: (error) => {
      toast.error('Eroare: ' + error.message);
    }
  });

  const checkInMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('visitors')
        .update({ 
          status: 'checked_in' as VisitorStatus,
          check_in_time: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast.success('Check-in efectuat');
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('visitors')
        .update({ 
          status: 'checked_out' as VisitorStatus,
          check_out_time: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast.success('Check-out efectuat');
    }
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      organization: '',
      id_document_type: '',
      id_document_number: '',
      purpose: '',
      host_name: '',
      host_department: '',
      expected_date: format(new Date(), 'yyyy-MM-dd'),
      badge_number: '',
      notes: ''
    });
  };

  const filteredVisitors = visitors?.filter(v => {
    const matchesSearch = v.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.host_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.organization?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Evidență Vizitatori
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Vizitator Nou
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Înregistrare Vizitator</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nume complet *</Label>
                <Input 
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nume și prenume"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Organizație</Label>
                <Input 
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  placeholder="Instituție / Companie"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tip document</Label>
                  <Select 
                    value={formData.id_document_type} 
                    onValueChange={(v) => setFormData({ ...formData, id_document_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectează" />
                    </SelectTrigger>
                    <SelectContent>
                      {idDocumentTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Serie/Număr</Label>
                  <Input 
                    value={formData.id_document_number}
                    onChange={(e) => setFormData({ ...formData, id_document_number: e.target.value })}
                    placeholder="Ex: AB123456"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Scopul vizitei *</Label>
                <Input 
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="Motivul vizitei"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gazdă *</Label>
                  <Input 
                    value={formData.host_name}
                    onChange={(e) => setFormData({ ...formData, host_name: e.target.value })}
                    placeholder="Persoana vizitată"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departament</Label>
                  <Input 
                    value={formData.host_department}
                    onChange={(e) => setFormData({ ...formData, host_department: e.target.value })}
                    placeholder="Departamentul"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data vizitei</Label>
                  <Input 
                    type="date" 
                    value={formData.expected_date}
                    onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nr. ecuson</Label>
                  <Input 
                    value={formData.badge_number}
                    onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
                    placeholder="Ex: V-001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observații..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Anulează
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Se salvează...' : 'Înregistrează'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută după nume, gazdă, organizație..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-[160px]"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate</SelectItem>
              <SelectItem value="expected">Așteptați</SelectItem>
              <SelectItem value="checked_in">Înregistrați</SelectItem>
              <SelectItem value="checked_out">Plecați</SelectItem>
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
                  <TableHead>Vizitator</TableHead>
                  <TableHead>Organizație</TableHead>
                  <TableHead>Scop vizită</TableHead>
                  <TableHead>Gazdă</TableHead>
                  <TableHead>Ecuson</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisitors?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nu există vizitatori pentru această dată
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVisitors?.map((visitor) => (
                    <TableRow key={visitor.id}>
                      <TableCell className="font-medium">
                        {visitor.full_name}
                      </TableCell>
                      <TableCell>
                        {visitor.organization || '-'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {visitor.purpose}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{visitor.host_name}</span>
                          {visitor.host_department && (
                            <span className="text-xs text-muted-foreground">
                              {visitor.host_department}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {visitor.badge_number || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusConfig[visitor.status].variant}>
                            {statusConfig[visitor.status].label}
                          </Badge>
                          {visitor.check_in_time && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(visitor.check_in_time), 'HH:mm')}
                              {visitor.check_out_time && (
                                <> - {format(new Date(visitor.check_out_time), 'HH:mm')}</>
                              )}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {visitor.status === 'expected' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="gap-1"
                              onClick={() => checkInMutation.mutate(visitor.id)}
                            >
                              <LogIn className="h-4 w-4" />
                              Check-in
                            </Button>
                          )}
                          {visitor.status === 'checked_in' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="gap-1"
                              onClick={() => checkOutMutation.mutate(visitor.id)}
                            >
                              <LogOut className="h-4 w-4" />
                              Check-out
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

export default VisitorLog;
