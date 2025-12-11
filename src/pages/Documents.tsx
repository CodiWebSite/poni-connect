import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Search, FileText, Download, FolderOpen, Upload, Plus, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface Document {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  file_url: string | null;
  created_at: string;
  uploaded_by: string | null;
}

const defaultCategories = [
  'Regulamente',
  'Formulare',
  'Proceduri',
  'Rapoarte',
  'Contracte',
  'Alte documente'
];

const categoryColors: Record<string, string> = {
  'Regulamente': 'bg-primary/10 text-primary',
  'Formulare': 'bg-accent/10 text-accent',
  'Proceduri': 'bg-info/10 text-info',
  'Rapoarte': 'bg-success/10 text-success',
  'Contracte': 'bg-warning/10 text-warning',
  'Alte documente': 'bg-muted text-muted-foreground',
};

const Documents = () => {
  const { user } = useAuth();
  const { canManageContent } = useUserRole();
  const { toast } = useToast();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Upload form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocDescription, setNewDocDescription] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setDocuments(data);
    }
    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!newDocName) {
        setNewDocName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile || !newDocName || !user) {
      toast({ title: 'Eroare', description: 'Completați toate câmpurile obligatorii.', variant: 'destructive' });
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${selectedFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Insert document record
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          name: newDocName,
          description: newDocDescription || null,
          category: newDocCategory || null,
          file_url: urlData.publicUrl,
          uploaded_by: user.id
        });

      if (insertError) throw insertError;

      toast({ title: 'Succes', description: 'Documentul a fost încărcat.' });
      setIsDialogOpen(false);
      resetForm();
      fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut încărca documentul.', variant: 'destructive' });
    }

    setUploading(false);
  };

  const deleteDocument = async (doc: Document) => {
    if (!confirm('Sigur doriți să ștergeți acest document?')) return;

    try {
      // Delete from storage if file exists
      if (doc.file_url) {
        const fileName = doc.file_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('documents').remove([fileName]);
        }
      }

      // Delete database record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast({ title: 'Succes', description: 'Documentul a fost șters.' });
      fetchDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge documentul.', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setNewDocName('');
    setNewDocDescription('');
    setNewDocCategory('');
    setSelectedFile(null);
  };

  const categories = [...new Set([
    ...defaultCategories,
    ...documents.map((d) => d.category).filter(Boolean)
  ])];

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group documents by category
  const documentsByCategory = filteredDocuments.reduce((acc, doc) => {
    const cat = doc.category || 'Necategorisit';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <MainLayout title="Documente" description="Regulamente, formulare și proceduri">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Caută documente..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 flex-wrap flex-1">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Toate
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {canManageContent && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Încarcă Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Încarcă Document Nou</DialogTitle>
                <DialogDescription>
                  Adăugați un document nou în bibliotecă
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Fișier *</Label>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Nume Document *</Label>
                  <Input
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="Introduceți numele documentului"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Descriere</Label>
                  <Textarea
                    value={newDocDescription}
                    onChange={(e) => setNewDocDescription(e.target.value)}
                    placeholder="Descriere opțională"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Categorie</Label>
                  <Select value={newDocCategory} onValueChange={setNewDocCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectați categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={uploadDocument} 
                  disabled={uploading || !selectedFile || !newDocName}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Se încarcă...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Încarcă
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-5 border border-border animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-card rounded-xl p-12 border border-border text-center">
          <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nu există documente</h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Încercați o altă căutare' : 'Documentele vor apărea aici'}
          </p>
        </div>
      ) : selectedCategory ? (
        // Show flat list when category is selected
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <DocumentItem 
              key={doc.id} 
              doc={doc} 
              canManageContent={canManageContent} 
              onDelete={deleteDocument} 
            />
          ))}
        </div>
      ) : (
        // Show grouped by category
        <div className="space-y-8">
          {Object.entries(documentsByCategory).map(([category, docs]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Badge className={categoryColors[category] || 'bg-muted text-muted-foreground'} variant="secondary">
                  {category}
                </Badge>
                <span className="text-muted-foreground text-sm font-normal">
                  ({docs.length} {docs.length === 1 ? 'document' : 'documente'})
                </span>
              </h2>
              <div className="space-y-3">
                {docs.map((doc) => (
                  <DocumentItem 
                    key={doc.id} 
                    doc={doc} 
                    canManageContent={canManageContent} 
                    onDelete={deleteDocument} 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
};

interface DocumentItemProps {
  doc: Document;
  canManageContent: boolean;
  onDelete: (doc: Document) => void;
}

const DocumentItem = ({ doc, canManageContent, onDelete }: DocumentItemProps) => (
  <div className="bg-card rounded-xl p-5 border border-border hover:shadow-md transition-all duration-200 flex items-center gap-4">
    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
      <FileText className="w-6 h-6 text-primary" />
    </div>
    
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-foreground truncate">{doc.name}</h3>
        {doc.category && (
          <Badge className={categoryColors[doc.category] || 'bg-muted text-muted-foreground'} variant="secondary">
            {doc.category}
          </Badge>
        )}
      </div>
      {doc.description && (
        <p className="text-sm text-muted-foreground line-clamp-1">{doc.description}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Adăugat pe {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: ro })}
      </p>
    </div>
    
    <div className="flex items-center gap-2">
      {doc.file_url && (
        <Button variant="ghost" size="icon" asChild>
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
            <Download className="w-5 h-5" />
          </a>
        </Button>
      )}
      {canManageContent && (
        <Button variant="ghost" size="icon" onClick={() => onDelete(doc)}>
          <Trash2 className="w-5 h-5 text-destructive" />
        </Button>
      )}
    </div>
  </div>
);

export default Documents;
