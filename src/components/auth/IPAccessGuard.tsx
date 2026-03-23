import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldX, Wifi } from 'lucide-react';

interface IPAccessGuardProps {
  children: React.ReactNode;
}

export default function IPAccessGuard({ children }: IPAccessGuardProps) {
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [message, setMessage] = useState('');
  const [clientIP, setClientIP] = useState('');

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-ip-access');

        if (cancelled) return;

        if (error) {
          // If function fails, allow access (fail-open for now)
          console.warn('IP check failed, allowing access:', error);
          setStatus('allowed');
          return;
        }

        if (data?.allowed) {
          setStatus('allowed');
        } else {
          setStatus('denied');
          setMessage(data?.message || 'Acces restricționat.');
          setClientIP(data?.ip || '');
        }
      } catch (err) {
        console.warn('IP check error, allowing access:', err);
        if (!cancelled) setStatus('allowed');
      }
    };

    checkAccess();
    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Se verifică accesul la rețea...</p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Acces Restricționat</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 justify-center text-muted-foreground">
              <Wifi className="w-4 h-4" />
              <span>IP detectat: <code className="bg-muted px-1.5 py-0.5 rounded">{clientIP}</code></span>
            </div>
            <p className="text-muted-foreground">
              Conectați-vă la rețeaua institutului sau folosiți VPN-ul pentru a accesa platforma.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Reîncearcă
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
