import { useState } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Info } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ToggleSetting {
  key: string;
  title: string;
  description: string;
}

const SETTINGS: ToggleSetting[] = [
  {
    key: 'announcements_open',
    title: 'Permisiune generală de adăugare a anunțurilor',
    description:
      'Orice angajat va avea posibilitatea de a adăuga anunțuri la rubrica de anunțuri din Social.',
  },
  {
    key: 'public_leave',
    title: 'Calendar public de concedii',
    description: 'Toți utilizatorii vor avea acces să vizualizeze calendarul public de concedii.',
  },
  {
    key: 'public_remote',
    title: 'Calendar public de telemuncă',
    description: 'Toți utilizatorii vor avea acces să vizualizeze calendarul public de telemuncă.',
  },
  {
    key: 'public_schedule',
    title: 'Calendar public program de lucru',
    description: 'Toți utilizatorii vor avea acces să vizualizeze calendarul public de program de lucru.',
  },
];

const SocialSettings = () => {
  const { canManageHR, isSuperAdmin, loading } = useUserRole();
  const [values, setValues] = useState<Record<string, boolean>>({});

  if (loading) return null;
  if (!canManageHR && !isSuperAdmin) return <Navigate to="/social" replace />;

  const handleToggle = (key: string, checked: boolean) => {
    setValues((v) => ({ ...v, [key]: checked }));
    toast.info('Persistarea setărilor va fi disponibilă într-o iterație viitoare');
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {SETTINGS.map((s) => (
          <Card key={s.key} className="rounded-2xl border-border p-5 flex flex-col">
            <h3 className="font-bold text-base mb-2 leading-tight">{s.title}</h3>
            <p className="text-xs text-muted-foreground mb-4 flex-1">{s.description}</p>
            <Switch
              checked={!!values[s.key]}
              onCheckedChange={(c) => handleToggle(s.key, c)}
            />
          </Card>
        ))}
      </div>

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
