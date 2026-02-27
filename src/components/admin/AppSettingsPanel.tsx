import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Loader2, Save, Clock, X } from 'lucide-react';

interface SettingsState {
  leave_module_beta: boolean;
  maintenance_mode: boolean;
  homepage_message: string;
  maintenance_eta: string;
}

const AppSettingsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsState>({
    leave_module_beta: true,
    maintenance_mode: false,
    homepage_message: '',
    maintenance_eta: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(row => { map[row.key] = row.value; });
        setSettings({
          leave_module_beta: map.leave_module_beta === true,
          maintenance_mode: map.maintenance_mode === true,
          homepage_message: typeof map.homepage_message === 'string' ? map.homepage_message : '',
          maintenance_eta: typeof map.maintenance_eta === 'string' ? map.maintenance_eta : '',
        });
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const updateSetting = async (key: string, value: any) => {
    setSaving(key);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: value as any, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('key', key);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut salva setarea.', variant: 'destructive' });
    } else {
      toast({ title: 'Salvat', description: 'Setarea a fost actualizată.' });
    }
    setSaving(null);
  };

  const toggleSetting = async (key: keyof SettingsState, checked: boolean) => {
    const wasMaintenance = settings.maintenance_mode;
    setSettings(prev => ({ ...prev, [key]: checked }));
    await updateSetting(key, checked);

    // When maintenance is turned OFF, notify email subscribers
    if (key === 'maintenance_mode' && wasMaintenance && !checked) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await supabase.functions.invoke('notify-maintenance-end', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const sent = res.data?.sent || 0;
          if (sent > 0) {
            toast({ title: 'Notificări trimise', description: `${sent} abonat(ți) au fost notificați pe email.` });
          }
        }
      } catch (e) {
        console.error('Failed to notify maintenance subscribers:', e);
      }
    }
  };

  const saveMessage = async () => {
    await updateSetting('homepage_message', settings.homepage_message);
  };

  const saveEta = async () => {
    const val = settings.maintenance_eta ? settings.maintenance_eta : null;
    await updateSetting('maintenance_eta', val);
  };

  const clearEta = async () => {
    setSettings(prev => ({ ...prev, maintenance_eta: '' }));
    await updateSetting('maintenance_eta', null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Setări Aplicație
        </CardTitle>
        <CardDescription>Configurează opțiunile globale ale platformei</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Beta banner toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="leave-beta" className="text-base font-medium">Banner Beta — Cereri Concediu</Label>
            <p className="text-sm text-muted-foreground">Afișează bannerul „Beta v0.9" pe pagina de cereri de concediu</p>
          </div>
          <Switch id="leave-beta" checked={settings.leave_module_beta} onCheckedChange={(c) => toggleSetting('leave_module_beta', c)} disabled={saving === 'leave_module_beta'} />
        </div>

        {/* Maintenance mode toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="maintenance" className="text-base font-medium">Mod Mentenanță</Label>
            <p className="text-sm text-muted-foreground">Afișează un banner de mentenanță pe toate paginile. Utilizatorii pot naviga în continuare.</p>
          </div>
          <Switch id="maintenance" checked={settings.maintenance_mode} onCheckedChange={(c) => toggleSetting('maintenance_mode', c)} disabled={saving === 'maintenance_mode'} />
        </div>

        {/* Maintenance ETA */}
        {settings.maintenance_mode && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance-eta" className="text-base font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Timp estimat de revenire
              </Label>
              <p className="text-sm text-muted-foreground">Setează data și ora estimativă de finalizare a mentenanței. Se va afișa un countdown pe pagina de mentenanță.</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="maintenance-eta"
                type="datetime-local"
                value={settings.maintenance_eta}
                onChange={(e) => setSettings(prev => ({ ...prev, maintenance_eta: e.target.value }))}
                className="max-w-xs"
              />
              <Button size="sm" onClick={saveEta} disabled={saving === 'maintenance_eta'}>
                {saving === 'maintenance_eta' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvează
              </Button>
              {settings.maintenance_eta && (
                <Button size="sm" variant="ghost" onClick={clearEta} disabled={saving === 'maintenance_eta'}>
                  <X className="w-4 h-4 mr-1" /> Șterge
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Custom homepage message */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="space-y-0.5">
            <Label htmlFor="homepage-msg" className="text-base font-medium">Mesaj personalizat pe pagina principală</Label>
            <p className="text-sm text-muted-foreground">Acest mesaj va apărea pe Dashboard-ul tuturor utilizatorilor. Lasă gol pentru a nu afișa nimic.</p>
          </div>
          <Textarea
            id="homepage-msg"
            placeholder="Ex: Programul de lucru se modifică începând cu..."
            value={settings.homepage_message}
            onChange={(e) => setSettings(prev => ({ ...prev, homepage_message: e.target.value }))}
            rows={3}
          />
          <Button size="sm" onClick={saveMessage} disabled={saving === 'homepage_message'}>
            {saving === 'homepage_message' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvează mesaj
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppSettingsPanel;
