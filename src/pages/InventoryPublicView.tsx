import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Building2, Cpu, MapPin } from 'lucide-react';
import PinGate from '@/components/inventory/PinGate';

const statusLabels: Record<string, string> = {
  available: 'Disponibil', assigned: 'Atribuit', in_repair: 'În reparație', decommissioned: 'Dezafectat',
};
const categoryLabels: Record<string, string> = {
  laptop: 'Laptop', pc: 'PC/Desktop', monitor: 'Monitor', imprimanta: 'Imprimantă',
  telefon: 'Telefon', ups: 'UPS', retea: 'Rețea', scanner: 'Scanner',
  card_acces: 'Card Acces', cheie: 'Cheie', altele: 'Altele',
};

const InventoryPublicView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const [item, setItem] = useState<any>(null);
  const [software, setSoftware] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  // Super admin auto-unlocks
  const isAuthed = user && isSuperAdmin;

  useEffect(() => {
    if (id) fetchPublicData();
  }, [id]);

  const fetchPublicData = async () => {
    setLoading(true);
    const { data } = await supabase.from('equipment_items').select('id, name, category, serial_number, status, building, floor, room, brand_model, inventory_number').eq('id', id!).maybeSingle();
    setItem(data);
    if (data) {
      const { data: sw } = await supabase.from('equipment_software').select('pc_name, os, antivirus, activity_type').eq('equipment_id', data.id);
      setSoftware(sw || []);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Echipament negăsit</p>
            <p className="text-sm text-muted-foreground mt-1">QR code-ul scanat nu corespunde unui echipament valid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthed && !unlocked) {
    return <PinGate equipmentId={item.id} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-start justify-center pt-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{item.name}</CardTitle>
              {item.inventory_number && <p className="text-xs font-mono text-muted-foreground">Nr. inv: {item.inventory_number}</p>}
            </div>
            <Badge>{statusLabels[item.status] || item.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Categorie</p>
              <p className="text-sm font-medium">{categoryLabels[item.category] || item.category}</p>
            </div>
            {item.brand_model && <div><p className="text-xs text-muted-foreground">Brand/Model</p><p className="text-sm font-medium">{item.brand_model}</p></div>}
            {item.serial_number && <div><p className="text-xs text-muted-foreground">Serie</p><p className="text-sm font-mono font-medium">{item.serial_number}</p></div>}
            {item.building && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />Locație</p>
                <p className="text-sm font-medium">
                  {item.building}{item.floor != null ? `, Et. ${item.floor}` : ''}{item.room ? `, Cam. ${item.room}` : ''}
                </p>
              </div>
            )}
          </div>

          {software.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Software
              </p>
              {software.map((sw, i) => (
                <div key={i} className="text-sm space-y-0.5 mb-2">
                  {sw.pc_name && <p><span className="text-muted-foreground">PC:</span> <span className="font-mono">{sw.pc_name}</span></p>}
                  {sw.os && <p><span className="text-muted-foreground">OS:</span> {sw.os}</p>}
                  {sw.antivirus && <p><span className="text-muted-foreground">Antivirus:</span> {sw.antivirus}</p>}
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center pt-2">ICMPP — Sistem de Inventariere IT</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPublicView;
