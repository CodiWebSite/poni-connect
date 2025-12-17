import { useState, useRef } from 'react';
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
import { Plus, Search, FileDown, FileUp, Check, Filter, Upload, File, Download, X } from 'lucide-react';
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
  file_url: string | null;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFile = async (file: File, registrationNumber: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${registrationNumber.replace(/\//g, '-')}_${Date.now()}.${fileExt}`;
    const filePath = `registry/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('secretariat-documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    return filePath;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { file?: File | null }) => {
      setIsUploading(true);
      
      // First create the document to get the registration number
      const { data: insertedDoc, error } = await supabase
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
        }])
        .select()
        .single();
      
      if (error) throw error;

      // If there's a file, upload it and update the record
      if (data.file && insertedDoc) {
        try {
          const filePath = await uploadFile(data.file, insertedDoc.registration_number);
          
          await supabase
            .from('document_registry')
            .update({ file_url: filePath })
            .eq('id', insertedDoc.id);
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
          toast.error('Document înregistrat, dar fișierul nu a putut fi încărcat');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-registry'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Document înregistrat cu succes');
    },
    onError: (error) => {
      toast.error('Eroare la înregistrare: ' + error.message);
    },
    onSettled: () => {
      setIsUploading(false);
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
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Fișierul este prea mare. Maxim 10MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const downloadFile = async (fileUrl: string, registrationNumber: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('secretariat-documents')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${registrationNumber}_${fileUrl.split('/').pop()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Eroare la descărcare');
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, file: selectedFile });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-5 w-5" />
          Registratură Documente
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Înregistrare Nouă
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Înregistrare Document</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Fișier Document</Label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                  />
                  {!selectedFile ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-20 border-dashed flex flex-col gap-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Click pentru a încărca un fișier
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PDF, DOC, XLS, JPG, PNG (max 10MB)
                      </span>
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <File className="h-5 w-5 text-primary" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {selectedFile.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
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
                <Button type="submit" disabled={createMutation.isPending || isUploading}>
                  {isUploading ? 'Se încarcă...' : createMutation.isPending ? 'Se salvează...' : 'Înregistrează'}
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
                  <TableHead>Fișier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                        {doc.file_url ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-primary"
                            onClick={() => downloadFile(doc.file_url!, doc.registration_number)}
                          >
                            <Download className="h-4 w-4" />
                            Descarcă
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
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
