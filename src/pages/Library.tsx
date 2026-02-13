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
import { BookOpen, Plus, Download, RotateCcw, UserPlus, Trash2, History, Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface EmployeeEntry {
  id: string;
  first_name: string;
  last_name: string;
}

interface BorrowRecord {
  id: string;
  action: string;
  employee_name: string | null;
  created_at: string;
}

const Library = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [canAccess, setCanAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [books, setBooks] = useState<Book[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [employees, setEmployees] = useState<EmployeeEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Pagination
  const PAGE_SIZE = 20;
  const [booksPage, setBooksPage] = useState(0);
  const [booksTotal, setBooksTotal] = useState(0);
  const [magsPage, setMagsPage] = useState(0);
  const [magsTotal, setMagsTotal] = useState(0);

  const [showAddBook, setShowAddBook] = useState(false);
  const [showAddMagazine, setShowAddMagazine] = useState(false);
  const [showBorrow, setShowBorrow] = useState<{ type: 'book' | 'magazine'; id: string } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [newBook, setNewBook] = useState({ cota: '', inventar: '', titlu: '', autor: '' });
  const [newMagazine, setNewMagazine] = useState({ titlu: '', an: new Date().getFullYear(), volum: '', numar: '' });

  // Inline editing
  const [editingBook, setEditingBook] = useState<string | null>(null);
  const [editBookData, setEditBookData] = useState<Partial<Book>>({});
  const [editingMag, setEditingMag] = useState<string | null>(null);
  const [editMagData, setEditMagData] = useState<Partial<Magazine>>({});

  // History
  const [showHistory, setShowHistory] = useState<{ type: 'book' | 'magazine'; id: string; title: string } | null>(null);
  const [historyRecords, setHistoryRecords] = useState<BorrowRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Check access
  useEffect(() => {
    if (roleLoading) return;
    if (!user) { navigate('/auth'); return; }
    const checkAccess = async () => {
      if (isSuperAdmin) { setCanAccess(true); setCheckingAccess(false); return; }
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (data && (data.role as string) === 'bibliotecar') setCanAccess(true);
      setCheckingAccess(false);
    };
    checkAccess();
  }, [user, isSuperAdmin, roleLoading, navigate]);

  // Load data
  useEffect(() => {
    if (!canAccess) return;
    const load = async () => {
      setLoadingData(true);
      const from = booksPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const magFrom = magsPage * PAGE_SIZE;
      const magTo = magFrom + PAGE_SIZE - 1;
      const [booksRes, magsRes, profilesRes] = await Promise.all([
        supabase.from('library_books' as any).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to),
        supabase.from('library_magazines' as any).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(magFrom, magTo),
        supabase.from('employee_personal_data').select('id, first_name, last_name').eq('is_archived', false).order('last_name'),
      ]);
      if (booksRes.data) setBooks(booksRes.data as any);
      if (booksRes.count != null) setBooksTotal(booksRes.count);
      if (magsRes.data) setMagazines(magsRes.data as any);
      if (magsRes.count != null) setMagsTotal(magsRes.count);
      if (profilesRes.data) setEmployees(profilesRes.data as EmployeeEntry[]);
      setLoadingData(false);
    };
    load();
  }, [canAccess, booksPage, magsPage]);

  const getEmployeeName = (epdId: string | null) => {
    if (!epdId) return 'Depozit';
    const e = employees.find(emp => emp.id === epdId);
    return e ? `${e.last_name} ${e.first_name}` : 'Necunoscut';
  };

  const logHistory = async (itemType: string, itemId: string, action: string, employeeId?: string | null) => {
    const empName = employeeId ? getEmployeeName(employeeId) : null;
    await supabase.from('library_borrow_history' as any).insert({
      item_type: itemType, item_id: itemId, action, employee_id: employeeId || null,
      employee_name: empName, performed_by: user?.id || null,
    } as any);
  };

  const handleAddBook = async () => {
    if (!newBook.cota || !newBook.inventar || !newBook.titlu || !newBook.autor) {
      toast({ title: 'Completează toate câmpurile', variant: 'destructive' }); return;
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
      toast({ title: 'Completează câmpurile obligatorii', variant: 'destructive' }); return;
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
    await logHistory(showBorrow.type, showBorrow.id, 'borrow', selectedEmployee);
    toast({ title: 'Împrumutat cu succes' });
    setShowBorrow(null);
    setSelectedEmployee('');
    refreshData();
  };

  const handleReturn = async (type: 'book' | 'magazine', id: string, borrowedBy: string | null) => {
    const table = type === 'book' ? 'library_books' : 'library_magazines';
    const { error } = await supabase.from(table as any).update({
      location_status: 'depozit', borrowed_by: null, returned_at: new Date().toISOString(),
    } as any).eq('id', id);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    await logHistory(type, id, 'return', borrowedBy);
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

  // Inline edit save
  const saveBookEdit = async (id: string) => {
    const { error } = await supabase.from('library_books' as any).update({
      cota: editBookData.cota, inventar: editBookData.inventar, titlu: editBookData.titlu, autor: editBookData.autor,
    } as any).eq('id', id);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Carte actualizată' });
    setEditingBook(null);
    refreshData();
  };

  const saveMagEdit = async (id: string) => {
    const { error } = await supabase.from('library_magazines' as any).update({
      titlu: editMagData.titlu, an: editMagData.an, volum: editMagData.volum || null, numar: editMagData.numar || null,
    } as any).eq('id', id);
    if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Revistă actualizată' });
    setEditingMag(null);
    refreshData();
  };

  const openHistory = async (type: 'book' | 'magazine', id: string, title: string) => {
    setShowHistory({ type, id, title });
    setLoadingHistory(true);
    const { data } = await supabase.from('library_borrow_history' as any).select('*')
      .eq('item_id', id).order('created_at', { ascending: false });
    setHistoryRecords((data as any) || []);
    setLoadingHistory(false);
  };

  const refreshData = async () => {
    const from = booksPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const magFrom = magsPage * PAGE_SIZE;
    const magTo = magFrom + PAGE_SIZE - 1;
    const [booksRes, magsRes] = await Promise.all([
      supabase.from('library_books' as any).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to),
      supabase.from('library_magazines' as any).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(magFrom, magTo),
    ]);
    if (booksRes.data) setBooks(booksRes.data as any);
    if (booksRes.count != null) setBooksTotal(booksRes.count);
    if (magsRes.data) setMagazines(magsRes.data as any);
    if (magsRes.count != null) setMagsTotal(magsRes.count);
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

          {/* === BOOKS TAB === */}
          <TabsContent value="books" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowAddBook(true)}><Plus className="w-4 h-4 mr-2" />Adaugă carte</Button>
              <Button variant="outline" onClick={exportBooksExcel}><Download className="w-4 h-4 mr-2" />Export Excel</Button>
            </div>
            {loadingData ? <p>Se încarcă...</p> : (
              <>
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
                          {editingBook === book.id ? (
                            <>
                              <TableCell><Input className="h-8 w-24" value={editBookData.cota || ''} onChange={e => setEditBookData(p => ({ ...p, cota: e.target.value }))} /></TableCell>
                              <TableCell><Input className="h-8 w-24" value={editBookData.inventar || ''} onChange={e => setEditBookData(p => ({ ...p, inventar: e.target.value }))} /></TableCell>
                              <TableCell><Input className="h-8" value={editBookData.titlu || ''} onChange={e => setEditBookData(p => ({ ...p, titlu: e.target.value }))} /></TableCell>
                              <TableCell><Input className="h-8" value={editBookData.autor || ''} onChange={e => setEditBookData(p => ({ ...p, autor: e.target.value }))} /></TableCell>
                              <TableCell>
                                <span className={book.location_status === 'depozit' ? 'text-green-600' : 'text-orange-600'}>
                                  {book.location_status === 'depozit' ? 'Depozit' : getEmployeeName(book.borrowed_by)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => saveBookEdit(book.id)}><Check className="w-3 h-3" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingBook(null)}><X className="w-3 h-3" /></Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
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
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingBook(book.id); setEditBookData({ cota: book.cota, inventar: book.inventar, titlu: book.titlu, autor: book.autor }); }}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => openHistory('book', book.id, book.titlu)}>
                                    <History className="w-3 h-3" />
                                  </Button>
                                  {book.location_status === 'depozit' ? (
                                    <Button size="sm" variant="outline" onClick={() => setShowBorrow({ type: 'book', id: book.id })}>
                                      <UserPlus className="w-3 h-3 mr-1" />Împrumută
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => handleReturn('book', book.id, book.borrowed_by)}>
                                      <RotateCcw className="w-3 h-3 mr-1" />Returnează
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete('book', book.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {booksTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-sm text-muted-foreground">
                      {booksPage * PAGE_SIZE + 1}–{Math.min((booksPage + 1) * PAGE_SIZE, booksTotal)} din {booksTotal} cărți
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={booksPage === 0} onClick={() => setBooksPage(p => p - 1)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={(booksPage + 1) * PAGE_SIZE >= booksTotal} onClick={() => setBooksPage(p => p + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* === MAGAZINES TAB === */}
          <TabsContent value="magazines" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowAddMagazine(true)}><Plus className="w-4 h-4 mr-2" />Adaugă revistă</Button>
              <Button variant="outline" onClick={exportMagazinesExcel}><Download className="w-4 h-4 mr-2" />Export Excel</Button>
            </div>
            {loadingData ? <p>Se încarcă...</p> : (
              <>
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
                          {editingMag === mag.id ? (
                            <>
                              <TableCell><Input className="h-8" value={editMagData.titlu || ''} onChange={e => setEditMagData(p => ({ ...p, titlu: e.target.value }))} /></TableCell>
                              <TableCell><Input className="h-8 w-20" type="number" value={editMagData.an || ''} onChange={e => setEditMagData(p => ({ ...p, an: parseInt(e.target.value) || 0 }))} /></TableCell>
                              <TableCell><Input className="h-8 w-20" value={editMagData.volum || ''} onChange={e => setEditMagData(p => ({ ...p, volum: e.target.value }))} /></TableCell>
                              <TableCell><Input className="h-8 w-20" value={editMagData.numar || ''} onChange={e => setEditMagData(p => ({ ...p, numar: e.target.value }))} /></TableCell>
                              <TableCell>
                                <span className={mag.location_status === 'depozit' ? 'text-green-600' : 'text-orange-600'}>
                                  {mag.location_status === 'depozit' ? 'Depozit' : getEmployeeName(mag.borrowed_by)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => saveMagEdit(mag.id)}><Check className="w-3 h-3" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingMag(null)}><X className="w-3 h-3" /></Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
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
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingMag(mag.id); setEditMagData({ titlu: mag.titlu, an: mag.an, volum: mag.volum, numar: mag.numar }); }}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => openHistory('magazine', mag.id, mag.titlu)}>
                                    <History className="w-3 h-3" />
                                  </Button>
                                  {mag.location_status === 'depozit' ? (
                                    <Button size="sm" variant="outline" onClick={() => setShowBorrow({ type: 'magazine', id: mag.id })}>
                                      <UserPlus className="w-3 h-3 mr-1" />Împrumută
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => handleReturn('magazine', mag.id, mag.borrowed_by)}>
                                      <RotateCcw className="w-3 h-3 mr-1" />Returnează
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete('magazine', mag.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {magsTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-sm text-muted-foreground">
                      {magsPage * PAGE_SIZE + 1}–{Math.min((magsPage + 1) * PAGE_SIZE, magsTotal)} din {magsTotal} reviste
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={magsPage === 0} onClick={() => setMagsPage(p => p - 1)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={(magsPage + 1) * PAGE_SIZE >= magsTotal} onClick={() => setMagsPage(p => p + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
      <Dialog open={!!showBorrow} onOpenChange={() => { setShowBorrow(null); setSelectedEmployee(''); setEmployeeSearch(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Împrumută</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Caută și selectează angajatul</Label>
            <Input
              placeholder="Caută după nume..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
            <div className="max-h-60 overflow-y-auto border rounded-md">
              {employees
                .filter(emp => {
                  const fullName = `${emp.last_name} ${emp.first_name}`.toLowerCase();
                  return fullName.includes(employeeSearch.toLowerCase());
                })
                .map(emp => (
                  <button
                    key={emp.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors ${selectedEmployee === emp.id ? 'bg-primary/10 font-medium text-primary' : ''}`}
                    onClick={() => setSelectedEmployee(emp.id)}
                  >
                    {emp.last_name} {emp.first_name}
                  </button>
                ))}
              {employees.filter(emp => `${emp.last_name} ${emp.first_name}`.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Niciun rezultat</p>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={handleBorrow} disabled={!selectedEmployee}>Confirmă împrumut</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Istoric: {showHistory?.title}</DialogTitle></DialogHeader>
          {loadingHistory ? <p>Se încarcă...</p> : historyRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nu există istoric pentru acest element.</p>
          ) : (
            <div className="rounded-md border max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acțiune</TableHead>
                    <TableHead>Angajat</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRecords.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className={r.action === 'borrow' ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                          {r.action === 'borrow' ? 'Împrumut' : 'Returnare'}
                        </span>
                      </TableCell>
                      <TableCell>{r.employee_name || '-'}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Library;
