import { useEffect, useState } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Maximize2, Download, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

const OrgChart = () => {
  const { user } = useAuth();
  const [zoom, setZoom] = useState(1);
  const [me, setMe] = useState<{ name: string; position: string; initials: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('employee_personal_data')
        .select('first_name, last_name, position')
        .eq('email', user.email || '')
        .eq('is_archived', false)
        .maybeSingle(),
    ]).then(([{ data: profile }, { data: epd }]) => {
      const name = epd
        ? `${epd.first_name} ${epd.last_name}`.trim()
        : profile?.full_name || user.email || 'Utilizator';
      const initials = name.split(' ').map((s) => s[0]).join('').substring(0, 2).toUpperCase();
      setMe({ name, position: epd?.position || '', initials });
    });
  }, [user]);

  return (
    <SocialLayout title="Organigramă" description="Structura organizațională ICMPP">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-xl"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-xl"
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={() => setZoom(1)}
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            Zoom fix
          </Button>
        </div>

        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => toast.info('Exportul va fi disponibil într-o iterație viitoare')}
        >
          <Download className="w-4 h-4 mr-2" />
          Exportă
        </Button>
      </div>

      <div className="flex justify-center py-12 overflow-auto">
        <div
          className="flex flex-col items-center gap-6 transition-transform"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {/* Root */}
          <Node initials="II" name="ICMPP" subtitle="Organizație" />
          <Connector />
          {me && <Node initials={me.initials} name={me.name} subtitle={me.position || 'Angajat'} />}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-12">
        Versiune simplificată. Organigrama interactivă completă va fi disponibilă într-o iterație viitoare.
      </p>
    </SocialLayout>
  );
};

const Node = ({ initials, name, subtitle }: { initials: string; name: string; subtitle: string }) => (
  <div className="bg-card border border-border rounded-2xl shadow-sm p-5 w-56 text-center">
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-muted-foreground">
      {initials}
    </div>
    <p className="font-bold text-sm leading-tight">{name}</p>
    <p className="text-xs text-primary mt-1">{subtitle}</p>
  </div>
);

const Connector = () => (
  <div className="flex flex-col items-center">
    <div className="w-px h-6 bg-primary/40" />
    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
      <Plus className="w-3 h-3 text-primary-foreground" />
    </div>
  </div>
);

export default OrgChart;
