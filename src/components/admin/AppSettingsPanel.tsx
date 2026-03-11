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
import { Settings, Loader2, Save, Clock, X, Monitor, Newspaper, Plus, Trash2, Image, Upload } from 'lucide-react';

interface SettingsState {
  leave_module_beta: boolean;
  maintenance_mode: boolean;
  homepage_message: string;
  maintenance_eta: string;
  kiosk_enabled: boolean;
  kiosk_message: string;
  kiosk_ticker_messages: string[];
  kiosk_slideshow_images: string[];
}

const AppSettingsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsState>({
    leave_module_beta: true,
    maintenance_mode: false,
    homepage_message: '',
    maintenance_eta: '',
    kiosk_enabled: true,
    kiosk_message: '',
    kiosk_ticker_messages: [],
    kiosk_slideshow_images: [],
  });
  const [newTickerMsg, setNewTickerMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
          kiosk_enabled: map.kiosk_enabled !== false,
          kiosk_message: typeof map.kiosk_message === 'string' ? map.kiosk_message : '',
          kiosk_ticker_messages: Array.isArray(map.kiosk_ticker_messages) ? map.kiosk_ticker_messages : [],
          kiosk_slideshow_images: Array.isArray(map.kiosk_slideshow_images) ? map.kiosk_slideshow_images : [],
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

  const saveKioskMessage = async () => {
    await updateSetting('kiosk_message', settings.kiosk_message || '');
  };

  const addTickerMessage = async () => {
    if (!newTickerMsg.trim()) return;
    const updated = [...settings.kiosk_ticker_messages, newTickerMsg.trim()];
    setSettings(prev => ({ ...prev, kiosk_ticker_messages: updated }));
    setNewTickerMsg('');
    await updateSetting('kiosk_ticker_messages', updated);
  };

  const removeTickerMessage = async (index: number) => {
    const updated = settings.kiosk_ticker_messages.filter((_, i) => i !== index);
    setSettings(prev => ({ ...prev, kiosk_ticker_messages: updated }));
    await updateSetting('kiosk_ticker_messages', updated);
  };

  const saveEta = async () => {
    const val = settings.maintenance_eta ? settings.maintenance_eta : null;
    await updateSetting('maintenance_eta', val);
  };

  const clearEta = async () => {
    setSettings(prev => ({ ...prev, maintenance_eta: '' }));
    await updateSetting('maintenance_eta', null);
  };

  // ── Slideshow image management ──
  const handleSlideshowUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);

    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop();
      const fileName = `slideshow-${Date.now()}-${i}.${ext}`;
      const { data, error } = await supabase.storage
        .from('kiosk-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) {
        toast({ title: 'Eroare upload', description: `Nu s-a putut încărca ${file.name}`, variant: 'destructive' });
        continue;
      }

      const { data: urlData } = supabase.storage.from('kiosk-images').getPublicUrl(data.path);
      newUrls.push(urlData.publicUrl);
    }

    if (newUrls.length > 0) {
      const updated = [...settings.kiosk_slideshow_images, ...newUrls];
      setSettings(prev => ({ ...prev, kiosk_slideshow_images: updated }));
      await updateSetting('kiosk_slideshow_images', updated);
      toast({ title: 'Succes', description: `${newUrls.length} imagine(i) adăugată(e) în slideshow.` });
    }

    setUploadingImage(false);
    // Reset file input
    e.target.value = '';
  };

  const removeSlideshowImage = async (index: number) => {
    const url = settings.kiosk_slideshow_images[index];
    // Try to delete from storage
    try {
      const pathMatch = url.split('/kiosk-images/').pop();
      if (pathMatch) {
        await supabase.storage.from('kiosk-images').remove([pathMatch]);
      }
    } catch (err) {
      console.warn('Could not delete file from storage:', err);
    }
    const updated = settings.kiosk_slideshow_images.filter((_, i) => i !== index);
    setSettings(prev => ({ ...prev, kiosk_slideshow_images: updated }));
    await updateSetting('kiosk_slideshow_images', updated);
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

        {/* Kiosk / TV Mode */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="kiosk-toggle" className="text-base font-medium flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                Mod Kiosk / TV
              </Label>
              <p className="text-sm text-muted-foreground">Activează pagina publică <code className="text-xs bg-muted px-1 py-0.5 rounded">/kiosk</code> pentru ecranele TV din instituție</p>
            </div>
            <Switch id="kiosk-toggle" checked={settings.kiosk_enabled} onCheckedChange={(c) => toggleSetting('kiosk_enabled', c)} disabled={saving === 'kiosk_enabled'} />
          </div>
          {settings.kiosk_enabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label htmlFor="kiosk-msg" className="text-sm font-medium">Mesaj personalizat pe ecranul TV</Label>
              <p className="text-xs text-muted-foreground">Apare ca banner în partea de sus a ecranului Kiosk. Lasă gol pentru a nu afișa.</p>
              <Textarea
                id="kiosk-msg"
                placeholder="Ex: Ședința generală — 15 Martie, Sala Mare, ora 10:00"
                value={settings.kiosk_message}
                onChange={(e) => setSettings(prev => ({ ...prev, kiosk_message: e.target.value }))}
                rows={2}
              />
              <Button size="sm" onClick={saveKioskMessage} disabled={saving === 'kiosk_message'}>
                {saving === 'kiosk_message' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvează mesaj TV
              </Button>

              {/* Ticker messages */}
              <div className="pt-3 border-t border-border space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-primary" />
                  Bandă de știri (ticker)
                </Label>
                <p className="text-xs text-muted-foreground">Mesajele vor defila orizontal în footer-ul ecranului Kiosk. Dacă lista e goală, banda nu se afișează.</p>
                
                {settings.kiosk_ticker_messages.length > 0 && (
                  <ul className="space-y-1">
                    {settings.kiosk_ticker_messages.map((msg, i) => (
                      <li key={i} className="flex items-center gap-2 rounded bg-muted px-3 py-1.5 text-sm">
                        <span className="flex-1 truncate">{msg}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => removeTickerMessage(i)} disabled={saving === 'kiosk_ticker_messages'}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Înscrierile pentru conferință se încheie vineri"
                    value={newTickerMsg}
                    onChange={(e) => setNewTickerMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTickerMessage(); } }}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={addTickerMessage} disabled={!newTickerMsg.trim() || saving === 'kiosk_ticker_messages'}>
                    <Plus className="w-4 h-4 mr-1" /> Adaugă
                  </Button>
                </div>
              </div>

              {/* Slideshow images */}
              <div className="pt-3 border-t border-border space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  Slideshow Kiosk (poze)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pozele se afișează pe ecranul TV <strong>după terminarea videoclipului de prezentare</strong>, câte 90 de secunde fiecare. 
                  După ce se termină toate pozele, videoclipul reîncepe automat.
                </p>

                {settings.kiosk_slideshow_images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {settings.kiosk_slideshow_images.map((url, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                        <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8"
                            onClick={() => removeSlideshowImage(i)}
                            disabled={saving === 'kiosk_slideshow_images'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                          {i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleSlideshowUpload}
                      disabled={uploadingImage}
                    />
                    <div className="flex items-center gap-2 border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/50 hover:bg-muted/50 transition-colors text-center justify-center">
                      {uploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {uploadingImage ? 'Se încarcă...' : 'Click pentru a adăuga imagini (poze instituție, evenimente, etc.)'}
                      </span>
                    </div>
                  </label>
                </div>

                {settings.kiosk_slideshow_images.length > 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    📸 {settings.kiosk_slideshow_images.length} imagine(i) · Fiecare se afișează 90 secunde pe ecranul TV
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AppSettingsPanel;
