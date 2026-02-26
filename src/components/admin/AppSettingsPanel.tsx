import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, Loader2 } from 'lucide-react';

const AppSettingsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaveBeta, setLeaveBeta] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'leave_module_beta')
        .maybeSingle();
      if (data) setLeaveBeta(data.value === true);
      setLoading(false);
    };
    fetch();
  }, []);

  const toggle = async (checked: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: checked as any, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('key', 'leave_module_beta');

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut salva setarea.', variant: 'destructive' });
    } else {
      setLeaveBeta(checked);
      toast({ title: 'Salvat', description: `Banner Beta ${checked ? 'activat' : 'dezactivat'}.` });
    }
    setSaving(false);
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
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="leave-beta" className="text-base font-medium">Banner Beta — Cereri Concediu</Label>
            <p className="text-sm text-muted-foreground">Afișează bannerul „Beta v0.9" pe pagina de cereri de concediu</p>
          </div>
          <Switch id="leave-beta" checked={leaveBeta} onCheckedChange={toggle} disabled={saving} />
        </div>
      </CardContent>
    </Card>
  );
};

export default AppSettingsPanel;
