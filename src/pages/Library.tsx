import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { BookOpen, Plus, Download, RotateCcw, UserPlus, Trash2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface Book {
  id: string;
  cota: string;
  inventar: string;
  titlu: string;
  autor: string;
  location_status: string;
  borrowed_by: string | null;
  borrowed_at: string | null;
  returned_at: string | null;
}

interface Magazine {
  id: string;
  titlu: string;
  an: number;
  volum: string | null;
  numar: string | null;
  location_status: string;
  borrowed_by: string | null;
  borrowed_at: string | null;
  returned_at: string | null;
}

interface Profile {
  user_id: string;
  full_name: string;
}

const Library = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [canAccess, setCanAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [books, setBooks] = useState<Book[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showAddBook, setShowAddBook] = useState(false);
  const [showAddMagazine, setShowAddMagazine] = useState(false);
  const [showBorrow, setShowBorrow] = useState<{ type: 'book' | 'magazine'; id: string } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const [newBook, setNewBook] = useState({ cota: '', inventar: '', titlu: '', autor: '' });
  const [newMagazine, setNewMagazine] = useState({ titlu: '', an: new Date().getFullYear(), volum: '', numar: '' });

  // Check access
  useEffect(() => {
    if (roleLoading) return;
    if (!user) { navigate('/auth'); return; }

    const checkAccess = async () => {
      if (isSuperAdmin) { setCanAccess(true); setCheckingAccess(false); return; }
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (data && (data.role as string) === 'bibliotecar') {
        setCanAccess(true);
      }
      setCheckingAccess(false);
    };
    checkAccess();
  }, [user, isSuperAdmin, roleLoading, navigate]);

  // Load data
  useEffect(() => {
    if (!canAccess) return;
    const load = async () => {
      setLoadingData(true);
      const [booksRes, magsRes, profilesRes] = await Promise.all([
        supabase.from('library_books' as any).select('*').order('created_at', { ascending: false }),
        supabase.from('library_magazines' as any).select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name'),
      ]);
      if (booksRes.data) setBooks(booksRes.data as any);
      if (magsRes.data) setMagazines(magsRes.data as any);
      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
      setLoadingData(false);
    };
    load();
  }, [canAccess]);

  const getEmployeeName = (userId: string | null) => {
    if (!userId) return 'Depozit';
    const p = profiles.find(pr => pr.user_id === userId);
    return p ? p.full_name : 'Necunoscut';
  };

  const handleAddBook = async () => {
    if (!newBook.cota || !newBook.inventar || !newBook.titlu || !newBook.autor) {
      toast({ title: 'Completează toate câmpurile', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('library_books' as any).insert({
      cota: newBook.cota, inventar: newBook.inventar, titlu: newBook.titlu, autor: newBook.autor,
    } as any);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Carte adăugată' });
    setNewBook({ cota: '', inventar: '', titlu: '', autor: '' });
    setShowAddBook(false);
    refreshData();
  };

  const handleAddMagazine = async () => {
    if (!newMagazine.titlu || !newMagazine.an) {
      toast({ title: 'Completează câmpurile obligatorii', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('library_magazines' as any).insert({
      titlu: newMagazine.titlu, an: newMagazine.an,
      volum: newMagazine.volum || null, numar: newMagazine.numar || null,
    } as any);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Revistă adăugată' });
    setNewMagazine({ titlu: '', an: new Date().getFullYear(), volum: '', numar: '' });
    setShowAddMagazine(false);
    refreshData();
  };

  const handleBorrow = async () => {
    if (!showBorrow || !selectedEmployee) return;
    const table = showBorrow.type === 'book' ? 'library_books' : 'library_magazines';
    const { error } = await supabase.from(table as any).update({
      location_status: 'imprumutat', borrowed_by: selectedEmployee, borrowed_at: new Date().toISOString(), returned_at: null,
    } as any).eq('id', showBorrow.id);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Împrumutat cu succes' });
    setShowBorrow(null);
    setSelectedEmployee('');
    refreshData();
  };

  const handleReturn = async (type: 'book' | 'magazine', id: string) => {
    const table = type === 'book' ? 'library_books' : 'library_magazines';
    const { error } = await supabase.from(table as any).update({
      location_status: 'depozit', borrowed_by: null, returned_at: new Date().toISOString(),
    } as any).eq('id', id);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Returnat cu succes' });
    refreshData();
  };

  const handleDelete = async (type: 'book' | 'magazine', id: string) => {
    const table = type === 'book' ? 'library_books' : 'library_magazines';
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Șters cu succes' });
    refreshData();
  };

  const refreshData = async () => {
    const [booksRes, magsRes] = await Promise.all([
      supabase.from('library_books' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('library_magazines' as any).select('*').order('created_at', { ascending: false }),
    ]);
    if (booksRes.data) setBooks(booksRes.data as any);
    if (magsRes.data) setMagazines(magsRes.data as any);
  };

  const exportBooksExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Cărți');
    ws.columns = [
      { header: 'Cotă', key: 'cota', width: 15 },
      { header: 'Inventar', key: 'inventar', width: 15 },
      { header: 'Titlu', key: 'titlu', width: 30 },
      { header: 'Autor', key: 'autor', width: 25 },
      { header: 'Locație', key: 'locatie', width: 20 },
      { header: 'Împrumutat la', key: 'imprumutat_la', width: 25 },
      { header: 'Data împrumut', key: 'data_imprumut', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    books.forEach(b => {
      ws.addRow({
        cota: b.cota, inventar: b.inventar, titlu: b.titlu, autor: b.autor,
        locatie: b.location_status === 'depozit' ? 'Depozit' : getEmployeeName(b.borrowed_by),
        imprumutat_la: getEmployeeName(b.borrowed_by),
        data_imprumut: b.borrowed_at ? new Date(b.borrowed_at).toLocaleDateString('ro-RO') : '-',
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `Raport_Carti_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportMagazinesExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Reviste');
    ws.columns = [
      { header: 'Titlu', key: 'titlu', width: 30 },
      { header: 'An', key: 'an', width: 10 },
      { header: 'Volum', key: 'volum', width: 15 },
      { header: 'Număr', key: 'numar', width: 15 },
      { header: 'Locație', key: 'locatie', width: 20 },
      { header: 'Împrumutat la', key: 'imprumutat_la', width: 25 },
      { header: 'Data împrumut', key: 'data_imprumut', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    magazines.forEach(m => {
      ws.addRow({
        titlu: m.titlu, an: m.an, volum: m.volum || '-', numar: m.numar || '-',
        locatie: m.location_status === 'depozit' ? 'Depozit' : getEmployeeName(m.borrowed_by),
        imprumutat_la: getEmployeeName(m.borrowed_by),
        data_imprumut: m.borrowed_at ? new Date(m.borrowed_at).toLocaleDateString('ro-RO') : '-',
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `Raport_Reviste_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (roleLoading || checkingAccess) {
    return <MainLayout title="Bibliotecă"><div className="flex items-center justify-center h-64"><p>Se încarcă...</p></div></MainLayout>;
  }

  if (!canAccess) {
    return <MainLayout title="Bibliotecă"><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Nu ai acces la această pagină.</p></div></MainLayout>;
  }

  return (
    <MainLayout title="Bibliotecă" description="Gestionarea cărților și revistelor">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bibliotecă</h1>
            <p className="text-muted-foreground">Gestionarea cărților și revistelor</p>
          </div>
        </div>

        <Tabs defaultValue="books" className="w-full">
          <TabsList>
            <TabsTrigger value="books">Cărți</TabsTrigger>
            <TabsTrigger value="magazines">Reviste</TabsTrigger>
          </TabsList>

          <TabsContent value="books" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowAddBook(true)}><Plus className="w-4 h-4 mr-2" />Adaugă carte</Button>
              <Button variant="outline" onClick={exportBooksExcel}><Download className="w-4 h-4 mr-2" />Export Excel</Button>
            </div>
            {loadingData ? <p>Se încarcă...</p> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cotă</TableHead>
                      <TableHead>Inventar</TableHead>
                      <TableHead>Titlu</TableHead>
                      <TableHead>Autor</TableHead>
                      <TableHead>Locație actuală</TableHead>
                      <TableHead>Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nu există cărți</TableCell></TableRow>
                    ) : books.map(book => (
                      <TableRow key={book.id}>
                        <TableCell>{book.cota}</TableCell>
                        <TableCell>{book.inventar}</TableCell>
                        <TableCell className="font-medium">{book.titlu}</TableCell>
                        <TableCell>{book.autor}</TableCell>
                        <TableCell>
                          <span className={book.location_status === 'depozit' ? 'text-green-600' : 'text-orange-600'}>
                            {book.location_status === 'depozit' ? 'Depozit' : getEmployeeName(book.borrowed_by)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {book.location_status === 'depozit' ? (
                              <Button size="sm" variant="outline" onClick={() => setShowBorrow({ type: 'book', id: book.id })}>
                                <UserPlus className="w-3 h-3 mr-1" />Împrumută
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleReturn('book', book.id)}>
                                <RotateCcw className="w-3 h-3 mr-1" />Returnează
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete('book', book.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="magazines" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowAddMagazine(true)}><Plus className="w-4 h-4 mr-2" />Adaugă revistă</Button>
              <Button variant="outline" onClick={exportMagazinesExcel}><Download className="w-4 h-4 mr-2" />Export Excel</Button>
            </div>
            {loadingData ? <p>Se încarcă...</p> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titlu</TableHead>
                      <TableHead>An</TableHead>
                      <TableHead>Volum</TableHead>
                      <TableHead>Număr</TableHead>
                      <TableHead>Locație actuală</TableHead>
                      <TableHead>Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {magazines.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nu există reviste</TableCell></TableRow>
                    ) : magazines.map(mag => (
                      <TableRow key={mag.id}>
                        <TableCell className="font-medium">{mag.titlu}</TableCell>
                        <TableCell>{mag.an}</TableCell>
                        <TableCell>{mag.volum || '-'}</TableCell>
                        <TableCell>{mag.numar || '-'}</TableCell>
                        <TableCell>
                          <span className={mag.location_status === 'depozit' ? 'text-green-600' : 'text-orange-600'}>
                            {mag.location_status === 'depozit' ? 'Depozit' : getEmployeeName(mag.borrowed_by)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {mag.location_status === 'depozit' ? (
                              <Button size="sm" variant="outline" onClick={() => setShowBorrow({ type: 'magazine', id: mag.id })}>
                                <UserPlus className="w-3 h-3 mr-1" />Împrumută
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleReturn('magazine', mag.id)}>
                                <RotateCcw className="w-3 h-3 mr-1" />Returnează
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete('magazine', mag.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Book Dialog */}
      <Dialog open={showAddBook} onOpenChange={setShowAddBook}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adaugă carte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Cotă</Label><Input value={newBook.cota} onChange={e => setNewBook(p => ({ ...p, cota: e.target.value }))} /></div>
            <div><Label>Inventar</Label><Input value={newBook.inventar} onChange={e => setNewBook(p => ({ ...p, inventar: e.target.value }))} /></div>
            <div><Label>Titlu</Label><Input value={newBook.titlu} onChange={e => setNewBook(p => ({ ...p, titlu: e.target.value }))} /></div>
            <div><Label>Autor</Label><Input value={newBook.autor} onChange={e => setNewBook(p => ({ ...p, autor: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddBook}>Salvează</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Magazine Dialog */}
      <Dialog open={showAddMagazine} onOpenChange={setShowAddMagazine}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adaugă revistă</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titlu</Label><Input value={newMagazine.titlu} onChange={e => setNewMagazine(p => ({ ...p, titlu: e.target.value }))} /></div>
            <div><Label>An</Label><Input type="number" value={newMagazine.an} onChange={e => setNewMagazine(p => ({ ...p, an: parseInt(e.target.value) || 0 }))} /></div>
            <div><Label>Volum</Label><Input value={newMagazine.volum} onChange={e => setNewMagazine(p => ({ ...p, volum: e.target.value }))} /></div>
            <div><Label>Număr</Label><Input value={newMagazine.numar} onChange={e => setNewMagazine(p => ({ ...p, numar: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddMagazine}>Salvează</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Borrow Dialog */}
      <Dialog open={!!showBorrow} onOpenChange={() => { setShowBorrow(null); setSelectedEmployee(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Împrumută</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Selectează angajatul</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger><SelectValue placeholder="Alege angajat..." /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleBorrow} disabled={!selectedEmployee}>Confirmă împrumut</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Library;
