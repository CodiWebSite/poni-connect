import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Building2, Monitor, History, QrCode, Cpu, HardDrive } from 'lucide-react';
import { format } from 'date-fns';
import EquipmentQRCode from '@/components/inventory/EquipmentQRCode';
import { Navigate } from 'react-router-dom';

const statusLabels: Record<string, string> = {
  available: 'Disponibil', assigned: 'Atribuit', in_repair: 'În reparație', decommissioned: 'Dezafectat',
};

const categoryLabels: Record<string, string> = {
  laptop: 'Laptop', pc: 'PC/Desktop', monitor: 'Monitor', imprimanta: 'Imprimantă',
  telefon: 'Telefon', ups: 'UPS', retea: 'Rețea', scanner: 'Scanner',
  card_acces: 'Card Acces', cheie: 'Cheie', altele: 'Altele',
};

const actionLabels: Record<string, string> = {
  assigned: 'Atribuit', returned: 'Returnat', transferred: 'Transferat',
  repair: 'Trimis la reparație', decommissioned: 'Dezafectat', created: 'Creat',
};

const InventoryProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [item, setItem] = useState<any>(null);
  const [software, setSoftware] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const defaultTab = searchParams.get('tab') || 'info';

  useEffect(() => {
    if (id && isSuperAdmin) fetchData();
  }, [id, isSuperAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: eqData }, { data: swData }, { data: histData }, { data: profData }] = await Promise.all([
      supabase.from('equipment_items').select('*').eq('id', id!).maybeSingle(),
      supabase.from('equipment_software').select('*').eq('equipment_id', id!),
      supabase.from('equipment_history').select('*').eq('equipment_id', id!).order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    setItem(eqData);
    setSoftware(swData || []);
    setHistory(histData || []);
    if (profData) {
      const map: Record<string, string> = {};
      profData.forEach(p => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
    setLoading(false);
  };

  if (authLoading || roleLoading) return <MainLayout title="Profil Echipament"><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  if (loading) return <MainLayout title="Profil Echipament"><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;
  if (!item) return <MainLayout title="Profil Echipament"><div className="text-center py-20 text-muted-foreground">Echipamentul nu a fost găsit.</div></MainLayout>;

  return (
    <MainLayout title="Profil Echipament">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{item.name}</h1>
            <p className="text-sm text-muted-foreground">
              {item.inventory_number && <span className="font-mono">Nr. inv: {item.inventory_number}</span>}
              {item.serial_number && <span className="ml-3 font-mono">Serie: {item.serial_number}</span>}
            </p>
          </div>
          <Badge className="ml-auto">{statusLabels[item.status] || item.status}</Badge>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="info"><Building2 className="w-4 h-4 mr-1" />Informații</TabsTrigger>
            <TabsTrigger value="software"><Cpu className="w-4 h-4 mr-1" />Software ({software.length})</TabsTrigger>
            <TabsTrigger value="history"><History className="w-4 h-4 mr-1" />Istoric</TabsTrigger>
            <TabsTrigger value="qr"><QrCode className="w-4 h-4 mr-1" />QR Code</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['Categorie', categoryLabels[item.category] || item.category],
                    ['Brand/Model', item.brand_model],
                    ['Nr. Inventar', item.inventory_number],
                    ['Serie', item.serial_number],
                    ['Clădire', item.building],
                    ['Etaj', item.floor != null ? `Etaj ${item.floor}` : null],
                    ['Cameră', item.room],
                    ['Status', statusLabels[item.status] || item.status],
                    ['Atribuit la', item.assigned_to_user_id ? profiles[item.assigned_to_user_id] : null],
                    ['Descriere', item.description],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="software">
            {software.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Fără înregistrări software.</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {software.map(sw => (
                  <Card key={sw.id}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {sw.pc_name && <div><p className="text-xs text-muted-foreground">Nume PC</p><p className="font-medium font-mono">{sw.pc_name}</p></div>}
                        {sw.os && <div><p className="text-xs text-muted-foreground">Sistem de operare</p><p className="font-medium">{sw.os}</p></div>}
                        {sw.license_type && <div><p className="text-xs text-muted-foreground">Licență</p><p className="font-medium">{sw.license_type}{sw.license_year ? ` (${sw.license_year})` : ''}</p></div>}
                        {sw.antivirus && <div><p className="text-xs text-muted-foreground">Antivirus</p><p className="font-medium">{sw.antivirus}{sw.antivirus_year ? ` (${sw.antivirus_year})` : ''}</p></div>}
                        {sw.activity_type && <div><p className="text-xs text-muted-foreground">Tip activitate</p><p className="font-medium">{sw.activity_type}</p></div>}
                        {sw.installed_apps && <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Aplicații instalate</p><p className="font-medium text-sm">{sw.installed_apps}</p></div>}
                        {sw.notes && <div className="md:col-span-3"><p className="text-xs text-muted-foreground">Observații</p><p className="text-sm">{sw.notes}</p></div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {history.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Fără istoric.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(h.created_at), 'dd.MM.yyyy HH:mm')}</span>
                        <Badge variant="outline" className="text-xs">{actionLabels[h.action] || h.action}</Badge>
                        {h.from_user_id && <span className="text-muted-foreground">de la {profiles[h.from_user_id] || '—'}</span>}
                        {h.to_user_id && <span>→ {profiles[h.to_user_id] || '—'}</span>}
                        {h.notes && <span className="text-xs italic text-muted-foreground ml-auto">— {h.notes}</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="qr">
            <EquipmentQRCode item={item} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default InventoryProfile;
