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
import { Plus, Search, FileDown, FileUp, Check, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

type DocumentDirection = 'incoming' | 'outgoing';

interface DocumentEntry {
  id: string;
  registration_number: string;
  direction: DocumentDirection;
  document_date: string;
  sender: string | null;
  recipient: string | null;
  subject: string;
  category: string | null;
  notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

const categories = [
  'Corespondență oficială',
  'Contracte',
  'Facturi',
  'Cereri',
  'Rapoarte',
  'Altele'
];

const DocumentRegistry = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('all');

  const [formData, setFormData] = useState({
    direction: 'incoming' as DocumentDirection,
    document_date: format(new Date(), 'yyyy-MM-dd'),
    sender: '',
    recipient: '',
    subject: '',
    category: '',
    notes: ''
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['document-registry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_registry')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DocumentEntry[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('document_registry')
        .insert([{
          direction: data.direction,
          document_date: data.document_date,
          sender: data.direction === 'incoming' ? data.sender : null,
          recipient: data.direction === 'outgoing' ? data.recipient : null,
          subject: data.subject,
          category: data.category || null,
          notes: data.notes || null,
          registration_number: ''
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-registry'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Document înregistrat cu succes');
    },
    onError: (error) => {
      toast.error('Eroare la înregistrare: ' + error.message);
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_registry')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-registry'] });
      toast.success('Document marcat ca rezolvat');
    }
  });

  const resetForm = () => {
    setFormData({
      direction: 'incoming',
      document_date: format(new Date(), 'yyyy-MM-dd'),
      sender: '',
      recipient: '',
      subject: '',
      category: '',
      notes: ''
    });
  };

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.sender?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.recipient?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDirection = filterDirection === 'all' || doc.direction === filterDirection;
    const matchesResolved = filterResolved === 'all' || 
      (filterResolved === 'resolved' && doc.resolved_at) ||
      (filterResolved === 'pending' && !doc.resolved_at);

    return matchesSearch && matchesDirection && matchesResolved;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-5 w-5" />
          Registratură Documente
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Înregistrare Nouă
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Înregistrare Document</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tip</Label>
                  <Select 
                    value={formData.direction} 
                    onValueChange={(v) => setFormData({ ...formData, direction: v as DocumentDirection })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incoming">Intrare</SelectItem>
                      <SelectItem value="outgoing">Ieșire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Document</Label>
                  <Input 
                    type="date" 
                    value={formData.document_date}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>
              </div>

              {formData.direction === 'incoming' ? (
                <div className="space-y-2">
                  <Label>Expeditor</Label>
                  <Input 
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    placeholder="Numele expeditorului"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Destinatar</Label>
                  <Input 
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    placeholder="Numele destinatarului"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Subiect *</Label>
                <Input 
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Subiectul documentului"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observații suplimentare..."
                  rows={3}
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
              placeholder="Caută după număr, subiect, expeditor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterDirection} onValueChange={setFilterDirection}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate</SelectItem>
              <SelectItem value="incoming">Intrări</SelectItem>
              <SelectItem value="outgoing">Ieșiri</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterResolved} onValueChange={setFilterResolved}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate</SelectItem>
              <SelectItem value="pending">În așteptare</SelectItem>
              <SelectItem value="resolved">Rezolvate</SelectItem>
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
                  <TableHead>Nr. Înreg.</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Expeditor/Destinatar</TableHead>
                  <TableHead>Subiect</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nu există documente înregistrate
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments?.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono font-medium">
                        {doc.registration_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.direction === 'incoming' ? 'default' : 'secondary'}>
                          {doc.direction === 'incoming' ? (
                            <><FileDown className="h-3 w-3 mr-1" />Intrare</>
                          ) : (
                            <><FileUp className="h-3 w-3 mr-1" />Ieșire</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(doc.document_date), 'dd MMM yyyy', { locale: ro })}
                      </TableCell>
                      <TableCell>
                        {doc.direction === 'incoming' ? doc.sender : doc.recipient}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {doc.subject}
                      </TableCell>
                      <TableCell>
                        {doc.resolved_at ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Rezolvat
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            În așteptare
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!doc.resolved_at && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => resolveMutation.mutate(doc.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Rezolvă
                          </Button>
                        )}
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

export default DocumentRegistry;
