import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Search, Package, UserPlus, RotateCcw, ArrowRightLeft, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
  description: string | null;
  status: string;
  assigned_to_user_id: string | null;
  assigned_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: string;
  equipment_id: string;
  action: string;
  from_user_id: string | null;
  to_user_id: string | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  laptop: 'Laptop',
  card_acces: 'Card Acces',
  cheie: 'Cheie',
  telefon: 'Telefon',
  altele: 'Altele',
};

const statusLabels: Record<string, string> = {
  available: 'Disponibil',
  assigned: 'Atribuit',
  in_repair: 'În reparație',
  decommissioned: 'Dezafectat',
};

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_repair: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  decommissioned: 'bg-muted text-muted-foreground',
};

const actionLabels: Record<string, string> = {
  assigned: 'Atribuit',
  returned: 'Returnat',
  transferred: 'Transferat',
  repair: 'Trimis la reparație',
  decommissioned: 'Dezafectat',
  created: 'Creat',
};

const EquipmentRegistry = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [form, setForm] = useState({ name: '', category: 'altele', serial_number: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Assign dialog
  const [assignDialog, setAssignDialog] = useState<{ item: EquipmentItem; type: 'assign' | 'transfer' } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  // History
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: eqData }, { data: profData }] = await Promise.all([
      supabase.from('equipment_items').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    if (eqData) setItems(eqData as EquipmentItem[]);
    if (profData) {
      const map: Record<string, string> = {};
      profData.forEach(p => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm({ name: '', category: 'altele', serial_number: '', description: '' });
    setShowDialog(true);
  };

  const openEdit = (item: EquipmentItem) => {
    setEditingItem(item);
    setForm({ name: item.name, category: item.category, serial_number: item.serial_number || '', description: item.description || '' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: 'Eroare', description: 'Denumirea este obligatorie.', variant: 'destructive' }); return; }
    setSaving(true);

    if (editingItem) {
      const { error } = await supabase.from('equipment_items').update({
        name: form.name, category: form.category, serial_number: form.serial_number || null, description: form.description || null,
      }).eq('id', editingItem.id);
      if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Succes', description: 'Echipamentul a fost actualizat.' }); }
    } else {
      const { error } = await supabase.from('equipment_items').insert({
        name: form.name, category: form.category, serial_number: form.serial_number || null,
        description: form.description || null, created_by: user?.id,
      });
      if (error) { toast({ title: 'Eroare', description: error.message, variant: 'destructive' }); }
      else {
        toast({ title: 'Succes', description: 'Echipamentul a fost adăugat.' });
        // Log creation
        if (user?.id) {
          const { data: newItem } = await supabase.from('equipment_items').select('id').eq('name', form.name).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (newItem) {
            await supabase.from('equipment_history').insert({ equipment_id: newItem.id, action: 'created', performed_by: user.id, notes: 'Echipament creat' });
          }
        }
      }
    }
    setSaving(false);
    setShowDialog(false);
    fetchData();
  };

  const handleAssign = async () => {
    if (!assignDialog || !selectedUserId) return;
    setSaving(true);
    const item = assignDialog.item;
    const isTransfer = assignDialog.type === 'transfer';

    await supabase.from('equipment_items').update({
      assigned_to_user_id: selectedUserId, assigned_at: new Date().toISOString(), status: 'assigned',
    }).eq('id', item.id);

    await supabase.from('equipment_history').insert({
      equipment_id: item.id,
      action: isTransfer ? 'transferred' : 'assigned',
      from_user_id: isTransfer ? item.assigned_to_user_id : null,
      to_user_id: selectedUserId,
      performed_by: user?.id,
      notes: actionNotes || null,
    });

    toast({ title: 'Succes', description: isTransfer ? 'Echipamentul a fost transferat.' : 'Echipamentul a fost atribuit.' });
    setSaving(false);
    setAssignDialog(null);
    setSelectedUserId('');
    setActionNotes('');
    fetchData();
  };

  const handleReturn = async (item: EquipmentItem) => {
    await supabase.from('equipment_items').update({
      assigned_to_user_id: null, assigned_at: null, status: 'available',
    }).eq('id', item.id);

    await supabase.from('equipment_history').insert({
      equipment_id: item.id, action: 'returned', from_user_id: item.assigned_to_user_id,
      performed_by: user?.id, notes: 'Returnat',
    });

    toast({ title: 'Succes', description: 'Echipamentul a fost returnat.' });
    fetchData();
  };

  const toggleHistory = async (itemId: string) => {
    if (expandedId === itemId) { setExpandedId(null); return; }
    setExpandedId(itemId);
    setLoadingHistory(true);
    const { data } = await supabase.from('equipment_history').select('*').eq('equipment_id', itemId).order('created_at', { ascending: false });
    setHistory(data as HistoryEntry[] || []);
    setLoadingHistory(false);
  };

  const filtered = items.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const assignedName = item.assigned_to_user_id ? (profiles[item.assigned_to_user_id] || '') : '';
      return item.name.toLowerCase().includes(q) || item.serial_number?.toLowerCase().includes(q) || assignedName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Registru Inventar Echipamente
              </CardTitle>
              <CardDescription>Gestionează echipamentele atribuite angajaților</CardDescription>
            </div>
            <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" />Adaugă</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Caută..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Categorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate categoriile</SelectItem>
                {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nu există echipamente.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Denumire</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead>Serie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atribuit la</TableHead>
                    <TableHead className="text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <Collapsible key={item.id} open={expandedId === item.id} asChild>
                      <>
                        <TableRow>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleHistory(item.id)}>
                                {expandedId === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{categoryLabels[item.category] || item.category}</TableCell>
                          <TableCell className="font-mono text-xs">{item.serial_number || '—'}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${statusColors[item.status] || ''}`} variant="secondary">
                              {statusLabels[item.status] || item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.assigned_to_user_id ? profiles[item.assigned_to_user_id] || '—' : '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)} title="Editează">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {item.status === 'available' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => { setAssignDialog({ item, type: 'assign' }); setSelectedUserId(''); setActionNotes(''); }} title="Atribuie">
                                  <UserPlus className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {item.status === 'assigned' && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleReturn(item)} title="Returnează">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => { setAssignDialog({ item, type: 'transfer' }); setSelectedUserId(''); setActionNotes(''); }} title="Transferă">
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7}>
                              {loadingHistory ? (
                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                              ) : history.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">Fără istoric.</p>
                              ) : (
                                <div className="space-y-2 py-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase">Istoric</p>
                                  {history.map(h => (
                                    <div key={h.id} className="flex items-center gap-3 text-sm">
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {format(new Date(h.created_at), 'dd.MM.yyyy HH:mm')}
                                      </span>
                                      <Badge variant="outline" className="text-xs">{actionLabels[h.action] || h.action}</Badge>
                                      {h.from_user_id && <span className="text-muted-foreground">de la {profiles[h.from_user_id] || '—'}</span>}
                                      {h.to_user_id && <span>→ {profiles[h.to_user_id] || '—'}</span>}
                                      {h.performed_by && <span className="text-xs text-muted-foreground">(de {profiles[h.performed_by] || '—'})</span>}
                                      {h.notes && <span className="text-xs italic text-muted-foreground">— {h.notes}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editează Echipament' : 'Adaugă Echipament'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Denumire *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Categorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Număr serie</Label>
              <Input value={form.serial_number} onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Anulează</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingItem ? 'Salvează' : 'Adaugă'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign/Transfer Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignDialog?.type === 'transfer' ? 'Transferă Echipament' : 'Atribuie Echipament'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Echipament: <strong>{assignDialog?.item.name}</strong>
              {assignDialog?.type === 'transfer' && assignDialog.item.assigned_to_user_id && (
                <> — în prezent la: <strong>{profiles[assignDialog.item.assigned_to_user_id] || '—'}</strong></>
              )}
            </p>
            <div>
              <Label>Selectează angajat</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Alege angajat..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(profiles).map(([uid, name]) => (
                    <SelectItem key={uid} value={uid}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (opțional)</Label>
              <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Anulează</Button>
            <Button onClick={handleAssign} disabled={!selectedUserId || saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {assignDialog?.type === 'transfer' ? 'Transferă' : 'Atribuie'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EquipmentRegistry;
