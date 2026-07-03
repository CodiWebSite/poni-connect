import { useEffect, useState } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bell, Info } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ToggleSetting {
  key: string;
  title: string;
  description: string;
}

const PLATFORM_SETTINGS: ToggleSetting[] = [
  {
    key: 'allow_announcements_all',
    title: 'Permisiune generală de adăugare a anunțurilor',
    description:
      'Orice angajat va avea posibilitatea de a adăuga anunțuri la rubrica de anunțuri din Social.',
  },
  {
    key: 'public_leave_calendar',
    title: 'Calendar public de concedii',
    description: 'Toți utilizatorii vor avea acces să vizualizeze calendarul public de concedii.',
  },
  {
    key: 'public_remote_calendar',
    title: 'Calendar public de telemuncă',
    description: 'Toți utilizatorii vor avea acces să vizualizeze calendarul public de telemuncă.',
  },
  {
    key: 'public_work_schedule',
    title: 'Calendar public program de lucru',
    description: 'Toți utilizatorii vor avea acces să vizualizeze calendarul public de program de lucru.',
  },
];

const NOTIFICATION_SETTINGS: ToggleSetting[] = [
  { key: 'social_notifications_post_comments', title: 'Notificări la comentarii pe postări', description: 'Autorul postării primește notificare când cineva comentează.' },
  { key: 'social_notifications_comment_replies', title: 'Notificări la răspunsuri', description: 'Autorul comentariului primește notificare când cineva îi răspunde.' },
  { key: 'social_notifications_post_reactions', title: 'Notificări la reacții pe postări', description: 'Autorul postării primește notificare când cineva reacționează.' },
  { key: 'social_notifications_comment_reactions', title: 'Notificări la reacții pe comentarii', description: 'Autorul comentariului primește notificare când cineva reacționează.' },
];

const SocialSettings = () => {
  const { canManageHR, isSuperAdmin, loading } = useUserRole();
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (supabase.from('social_settings' as any) as any)
      .select('key, value')
      .then(({ data }: any) => {
        const map: Record<string, boolean> = {};
        (data || []).forEach((row: any) => {
          map[row.key] = !!row.value?.enabled;
        });
        setValues(map);
      });
  }, []);

  if (loading) return null;
  if (!canManageHR && !isSuperAdmin) return <Navigate to="/social" replace />;

  const handleToggle = async (key: string, checked: boolean) => {
    setValues((v) => ({ ...v, [key]: checked }));
    setSaving(key);
    const { error } = await (supabase.from('social_settings' as any) as any).upsert({
      key,
      value: { enabled: checked },
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    });
    setSaving(null);
    if (error) {
      toast.error('Eroare la salvare: ' + error.message);
      setValues((v) => ({ ...v, [key]: !checked }));
    } else {
      toast.success('Setare salvată');
    }
  };

  return (
    <SocialLayout title="Setări" description="Permisiuni și vizibilități pentru Intranet Social">
      <Tabs defaultValue="apps">
        <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-6 mb-6">
          <TabsTrigger
            value="apps"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
          >
            Intranet Apps
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="rounded-2xl border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-display font-bold text-2xl">Intranet Social</h2>
          <Info className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Vizualizează ultimele noutăți, alături de zile de naștere, aniversări și organigrama companiei
        </p>
      </Card>

      <h3 className="font-display font-bold text-lg mb-3">Funcționalități</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {PLATFORM_SETTINGS.map((s) => (
          <Card key={s.key} className="rounded-2xl border-border p-5 flex flex-col">
            <h3 className="font-bold text-base mb-2 leading-tight">{s.title}</h3>
            <p className="text-xs text-muted-foreground mb-4 flex-1">{s.description}</p>
            <Switch
              checked={!!values[s.key]}
              disabled={saving === s.key}
              onCheckedChange={(c) => handleToggle(s.key, c)}
            />
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-border p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-lg">Notificări feed</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {NOTIFICATION_SETTINGS.map((s) => (
            <div key={s.key} className="rounded-2xl border border-border p-4 flex flex-col bg-background">
              <h4 className="font-bold text-sm mb-2 leading-tight">{s.title}</h4>
              <p className="text-xs text-muted-foreground mb-4 flex-1">{s.description}</p>
              <Switch checked={values[s.key] !== false} disabled={saving === s.key} onCheckedChange={(c) => handleToggle(s.key, c)} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl border-border p-5 max-w-sm">
        <h3 className="font-bold text-base mb-2">Permisiuni utilizatori în Intranet Social</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Aici stabilești modul în care utilizatorii vor avea acces la Intranet Social.
        </p>
        <Link
          to="/admin"
          className="text-sm font-medium text-primary hover:underline"
        >
          Gestionează permisiuni
        </Link>
      </Card>
    </SocialLayout>
  );
};

export default SocialSettings;
