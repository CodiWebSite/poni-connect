import { useState, useEffect } from 'react';
import { ShieldX, Wifi, LogIn, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface IPAccessGuardProps {
  children: React.ReactNode;
}

export default function IPAccessGuard({ children }: IPAccessGuardProps) {
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [message, setMessage] = useState('');
  const [clientIP, setClientIP] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const checkAccess = async (authToken?: string) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/check-ip-access`,
        { method: 'POST', headers }
      );

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
      setStatus('denied');
      setMessage('Nu s-a putut verifica accesul la rețea. Verificați conexiunea și reîncercați.');
      setClientIP('necunoscut');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Check if user is already logged in and has bypass
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        await checkAccess(session?.access_token);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  const handleBypassLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError('Email sau parolă incorectă.');
        setLoginLoading(false);
        return;
      }

      if (data.session) {
        // Re-check with auth token
        setStatus('checking');
        await checkAccess(data.session.access_token);
        
        if (status === 'denied') {
          // User doesn't have bypass - sign them out
          await supabase.auth.signOut();
          setLoginError('Contul tău nu are acces de la distanță. Contactează administratorul.');
          setStatus('denied');
        }
      }
    } catch {
      setLoginError('Eroare la autentificare.');
    }
    setLoginLoading(false);
  };

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

          {!showLogin ? (
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Reîncearcă
              </button>
              <div>
                <button
                  onClick={() => setShowLogin(true)}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Am acces de la distanță
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBypassLogin} className="space-y-3 text-left">
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Autentifică-te pentru a verifica accesul de la distanță
                </p>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Parolă"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                {loginError && (
                  <p className="text-sm text-destructive text-center">{loginError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowLogin(false)}
                  >
                    Înapoi
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loginLoading}>
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verifică
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
