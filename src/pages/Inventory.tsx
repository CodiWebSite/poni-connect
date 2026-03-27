import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Package, QrCode, Building2, Monitor, Upload, Eye } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import InventoryImport from '@/components/inventory/InventoryImport';

const categoryLabels: Record<string, string> = {
  laptop: 'Laptop', pc: 'PC/Desktop', monitor: 'Monitor', imprimanta: 'Imprimantă',
  telefon: 'Telefon', ups: 'UPS', retea: 'Rețea', scanner: 'Scanner',
  card_acces: 'Card Acces', cheie: 'Cheie', altele: 'Altele',
};

const statusLabels: Record<string, string> = {
  available: 'Disponibil', assigned: 'Atribuit', in_repair: 'În reparație', decommissioned: 'Dezafectat',
};

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_repair: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  decommissioned: 'bg-muted text-muted-foreground',
};

const Inventory = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [tab, setTab] = useState('list');

  useEffect(() => { if (user && isSuperAdmin) fetchItems(); }, [user, isSuperAdmin]);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('equipment_items').select('*').order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  if (authLoading || roleLoading) return <MainLayout title="Inventar IT"><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const buildings = [...new Set(items.map(i => i.building).filter(Boolean))];

  const filtered = items.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (filterBuilding !== 'all' && item.building !== filterBuilding) return false;
    if (search) {
      const q = search.toLowerCase();
      return (item.name?.toLowerCase().includes(q) ||
        item.inventory_number?.toLowerCase().includes(q) ||
        item.serial_number?.toLowerCase().includes(q) ||
        item.brand_model?.toLowerCase().includes(q) ||
        item.room?.toLowerCase().includes(q));
    }
    return true;
  });

  // Stats
  const totalItems = items.length;
  const byCategory = Object.entries(
    items.reduce((acc: Record<string, number>, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);
  const byBuilding = Object.entries(
    items.reduce((acc: Record<string, number>, i) => { if (i.building) acc[i.building] = (acc[i.building] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Inventar IT
          </h1>
          <p className="text-muted-foreground text-sm">Gestiune avansată echipamente și software</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-primary">{totalItems}</p>
              <p className="text-xs text-muted-foreground">Total echipamente</p>
            </CardContent>
          </Card>
          {byCategory.slice(0, 3).map(([cat, count]) => (
            <Card key={cat}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{categoryLabels[cat] || cat}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="list"><Monitor className="w-4 h-4 mr-1" />Lista echipamente</TabsTrigger>
            <TabsTrigger value="import"><Upload className="w-4 h-4 mr-1" />Import XLS</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Caută (nume, inventar, serie)..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Categorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate categoriile</SelectItem>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              {buildings.length > 0 && (
                <Select value={filterBuilding} onValueChange={setFilterBuilding}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Clădire" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate clădirile</SelectItem>
                    {buildings.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nu există echipamente{search ? ' pentru căutarea curentă' : ''}.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr. Inventar</TableHead>
                      <TableHead>Denumire</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead>Clădire</TableHead>
                      <TableHead>Etaj/Cameră</TableHead>
                      <TableHead>Serie</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.inventory_number || '—'}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{categoryLabels[item.category] || item.category}</Badge></TableCell>
                        <TableCell className="text-sm">{item.building || '—'}</TableCell>
                        <TableCell className="text-sm">{[item.floor != null ? `Et. ${item.floor}` : '', item.room].filter(Boolean).join(', ') || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{item.serial_number || '—'}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColors[item.status] || ''}`} variant="secondary">
                            {statusLabels[item.status] || item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/inventory/${item.id}`)} title="Vezi detalii">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/inventory/${item.id}?tab=qr`)} title="QR Code">
                              <QrCode className="w-3.5 h-3.5" />
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

          <TabsContent value="import">
            <InventoryImport onComplete={fetchItems} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Inventory;
