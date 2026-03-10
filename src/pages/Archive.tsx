import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Archive, Upload, Download, Search, FileText, Trash2, Scale, Shield, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

const NOMENCLATOR_CATEGORIES = [
  { value: 'acte_personal', label: 'Acte de personal', defaultRetention: 100 },
  { value: 'financiar_contabile', label: 'Documente financiar-contabile', defaultRetention: 10 },
  { value: 'corespondenta', label: 'Corespondență oficială', defaultRetention: 5 },
  { value: 'contracte', label: 'Contracte', defaultRetention: 10 },
  { value: 'rapoarte', label: 'Rapoarte de activitate', defaultRetention: 100 },
  { value: 'procese_verbale', label: 'Procese verbale', defaultRetention: 100 },
  { value: 'decizii', label: 'Decizii și dispoziții', defaultRetention: 100 },
  { value: 'cercetare', label: 'Documentație cercetare', defaultRetention: 100 },
  { value: 'alte_documente', label: 'Alte documente', defaultRetention: 5 },
];

const RETENTION_OPTIONS = [
  { value: 5, label: '5 ani' },
  { value: 10, label: '10 ani' },
  { value: 25, label: '25 ani' },
  { value: 50, label: '50 ani' },
  { value: 100, label: 'Permanent' },
];

type ArchiveDoc = {
  id: string;
  registration_number: string;
  department: string;
  nomenclator_category: string;
  retention_years: number;
  retention_expires_at: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  archived_at: string;
  created_at: string;
};

export default function ArchivePage() {
  const { user } = useAuth();
  const { canManageHR, isSuperAdmin } = useUserRole();
  const [docs, setDocs] = useState<ArchiveDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [userDept, setUserDept] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadRetention, setUploadRetention] = useState<number>(5);
  const [uploadDescription, setUploadDescription] = useState('');

  // Fetch user department
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('department').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setUserDept(data?.department || null));
  }, [user]);

  // Fetch departments for HR filter
  useEffect(() => {
    if (!canManageHR) return;
    supabase.from('employee_personal_data').select('department').not('department', 'is', null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(d => d.department).filter(Boolean))] as string[];
          setDepartments(unique.sort());
        }
      });
  }, [canManageHR]);

  const fetchDocs = async () => {
    setLoading(true);
    let query = supabase.from('archive_documents').select('*').order('archived_at', { ascending: false });
    if (filterCategory && filterCategory !== 'all') query = query.eq('nomenclator_category', filterCategory);
    if (canManageHR && filterDept && filterDept !== 'all') query = query.eq('department', filterDept);
    if (search) query = query.or(`file_name.ilike.%${search}%,description.ilike.%${search}%,registration_number.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching archive docs:', error);
    }
    setDocs((data as ArchiveDoc[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [search, filterCategory, filterDept, canManageHR]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadCategory || !userDept) {
      toast({ title: 'Completați toate câmpurile obligatorii', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const filePath = `${userDept}/${Date.now()}_${uploadFile.name}`;

      const { error: storageError } = await supabase.storage.from('archive-documents').upload(filePath, uploadFile);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from('archive-documents').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('archive_documents').insert({
        department: userDept,
        nomenclator_category: uploadCategory,
        retention_years: uploadRetention,
        file_url: filePath,
        file_name: uploadFile.name,
        file_size: uploadFile.size,
        description: uploadDescription || null,
        uploaded_by: user?.id,
      } as any);

      if (insertError) throw insertError;

      toast({ title: 'Document arhivat cu succes' });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadCategory('');
      setUploadRetention(5);
      setUploadDescription('');
      fetchDocs();
    } catch (err: any) {
      toast({ title: 'Eroare la arhivare', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: ArchiveDoc) => {
    if (!doc.file_url) return;
    // Log access
    await supabase.from('archive_access_log').insert({
      document_id: doc.id,
      user_id: user?.id,
      action: 'download',
    } as any);

    const { data, error } = await supabase.storage.from('archive-documents').download(doc.file_url);
    if (error || !data) {
      toast({ title: 'Eroare la descărcare', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file_name || 'document';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (doc: ArchiveDoc) => {
    if (!confirm('Sigur doriți să ștergeți acest document din arhivă?')) return;
    if (doc.file_url) {
      await supabase.storage.from('archive-documents').remove([doc.file_url]);
    }
    const { error } = await supabase.from('archive_documents').delete().eq('id', doc.id);
    if (error) {
      toast({ title: 'Eroare la ștergere', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document șters' });
      fetchDocs();
    }
  };

  const getCategoryLabel = (val: string) => NOMENCLATOR_CATEGORIES.find(c => c.value === val)?.label || val;
  const getRetentionLabel = (years: number) => years >= 100 ? 'Permanent' : `${years} ani`;
  const isExpired = (expiresAt: string) => new Date(expiresAt) <= new Date();

  const handleCategoryChange = (val: string) => {
    setUploadCategory(val);
    const cat = NOMENCLATOR_CATEGORIES.find(c => c.value === val);
    if (cat) setUploadRetention(cat.defaultRetention);
  };

  // Stats
  const totalDocs = docs.length;
  const permanentDocs = docs.filter(d => d.retention_years >= 100).length;
  const expiredDocs = docs.filter(d => isExpired(d.retention_expires_at) && d.retention_years < 100).length;

  return (
    <MainLayout title="Arhivă Online" description="Arhivare electronică conform Legii 16/1996">
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="h-7 w-7 text-primary" />
              Arhivă Online
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conform Legii 16/1996 (Arhivele Naționale) și Legii 135/2007 (arhivare electronică)
            </p>
          </div>
          {userDept && (
            <Button onClick={() => setUploadOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" /> Arhivează Document
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalDocs}</p>
                <p className="text-sm text-muted-foreground">Total documente</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{permanentDocs}</p>
                <p className="text-sm text-muted-foreground">Permanente</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Scale className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{expiredDocs}</p>
                <p className="text-sm text-muted-foreground">Termen expirat</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Caută după nume, descriere sau nr. înregistrare..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate categoriile</SelectItem>
                  {NOMENCLATOR_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canManageHR && (
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Departament" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate departamentele</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr. Înreg.</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="hidden md:table-cell">Categorie</TableHead>
                  <TableHead className="hidden md:table-cell">Departament</TableHead>
                  <TableHead className="hidden lg:table-cell">Termen</TableHead>
                  <TableHead className="hidden lg:table-cell">Arhivat la</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Se încarcă...</TableCell>
                  </TableRow>
                ) : docs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      Nu sunt documente în arhivă
                    </TableCell>
                  </TableRow>
                ) : docs.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-xs">{doc.registration_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{doc.file_name || '—'}</p>
                        {doc.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{getCategoryLabel(doc.nomenclator_category)}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{doc.department}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant={doc.retention_years >= 100 ? 'default' : isExpired(doc.retention_expires_at) ? 'destructive' : 'secondary'} className="text-xs">
                        {getRetentionLabel(doc.retention_years)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {format(new Date(doc.archived_at), 'dd MMM yyyy', { locale: ro })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {doc.file_url && (
                          <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)} title="Descarcă">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {canManageHR && isExpired(doc.retention_expires_at) && doc.retention_years < 100 && (
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(doc)} title="Șterge">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" /> Arhivează Document
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Departament</Label>
                <Input value={userDept || '—'} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">Se preia automat din profilul dvs.</p>
              </div>
              <div>
                <Label>Categorie nomenclator *</Label>
                <Select value={uploadCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger><SelectValue placeholder="Selectați categoria" /></SelectTrigger>
                  <SelectContent>
                    {NOMENCLATOR_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Termen de păstrare *</Label>
                <Select value={String(uploadRetention)} onValueChange={v => setUploadRetention(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RETENTION_OPTIONS.map(r => (
                      <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descriere</Label>
                <Textarea value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} placeholder="Descriere opțională..." rows={2} />
              </div>
              <div>
                <Label>Fișier *</Label>
                <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Anulează</Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Se arhivează...' : 'Arhivează'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
