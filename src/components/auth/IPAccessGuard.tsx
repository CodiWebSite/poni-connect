import { useState, useEffect } from 'react';
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
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/check-ip-access`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
            },
          }
        );

        if (cancelled) return;

        const data = await res.json();

        if (data?.allowed === true) {
          setStatus('allowed');
        } else {
          setStatus('denied');
          setMessage(data?.message || 'Accesul este restricționat. Această platformă poate fi accesată doar din rețeaua institutului.');
          setClientIP(data?.ip || 'necunoscut');
        }
      } catch (err) {
        console.warn('IP check error:', err);
        if (!cancelled) {
          // Fail-closed: block access if we can't verify
          setStatus('denied');
          setMessage('Nu s-a putut verifica accesul la rețea. Verificați conexiunea și reîncercați.');
          setClientIP('necunoscut');
        }
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
              Conectați-vă la rețeaua institutului pentru a accesa platforma.
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
