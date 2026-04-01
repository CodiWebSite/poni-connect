import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2, XCircle, Loader2, Shield, Database, HardDrive, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface HealthCheck {
  overall: string;
  checks: Record<string, { status: string; message?: string }>;
  checked_at: string;
}

const serviceIcons: Record<string, any> = {
  auth: Shield,
  database: Database,
  storage: HardDrive,
  edge_functions: Zap,
};

const SystemHealthMini = () => {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('health_check_logs')
        .select('overall, checks, checked_at')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setHealth(data as unknown as HealthCheck);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const checks = health?.checks || {};
  const services = Object.entries(checks);
  const isHealthy = health?.overall === 'healthy';

  return (
    <Card className={cn(!isHealthy && health && 'border-destructive/30')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className={cn('w-4 h-4', isHealthy ? 'text-success' : 'text-destructive')} />
          Stare Sistem
          <span className={cn(
            'ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full',
            isHealthy ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          )}>
            {isHealthy ? 'OK' : 'Probleme'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Niciun health check disponibil. <Link to="/admin" className="text-primary hover:underline">Rulează verificare</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {services.map(([key, val]) => {
              const Icon = serviceIcons[key] || Activity;
              const ok = val.status === 'healthy' || val.status === 'ok';
              return (
                <div
                  key={key}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-xs',
                    ok ? 'border-success/20 bg-success/5' : 'border-destructive/20 bg-destructive/5'
                  )}
                >
                  <Icon className={cn('w-3.5 h-3.5', ok ? 'text-success' : 'text-destructive')} />
                  <span className="font-medium text-foreground capitalize">{key.replace('_', ' ')}</span>
                  {ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success ml-auto" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-destructive ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {health?.checked_at && (
          <p className="text-[10px] text-muted-foreground mt-2 text-right">
            Ultima verificare: {format(new Date(health.checked_at), 'd MMM, HH:mm', { locale: ro })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemHealthMini;
