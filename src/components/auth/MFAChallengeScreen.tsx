import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { ShieldCheck, Loader2, LogOut, KeyRound, LifeBuoy } from 'lucide-react';
import MolecularPattern from './MolecularPattern';
import MFARecoveryEntry from './MFARecoveryEntry';
import MFAResetRequestForm from './MFAResetRequestForm';

interface MFAChallengeScreenProps {
  onVerified: () => void;
}

const MAX_ATTEMPTS = 5;
const TRUSTED_TOKEN_KEY = 'icmpp_trusted_device_token';

export default function MFAChallengeScreen({ onVerified }: MFAChallengeScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [view, setView] = useState<'challenge' | 'recovery' | 'reset'>('challenge');
  const [userEmail, setUserEmail] = useState<string>('');
  const checkingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (totp) setFactorId(totp.id);
      const { data: u } = await supabase.auth.getUser();
      if (!cancelled) setUserEmail(u?.user?.email ?? '');

      // Check trusted device — if valid, skip MFA challenge entirely.
      if (checkingRef.current) return;
      checkingRef.current = true;
      const token = localStorage.getItem(TRUSTED_TOKEN_KEY);
      if (token) {
        try {
          const { data, error } = await supabase.functions.invoke('mfa-trusted-check', {
            body: { token },
          });
          if (!error && data?.valid) {
            sessionStorage.setItem('icmpp_trusted_session', '1');
            onVerified();
          } else if (data && data.valid === false && ['not_found', 'mismatch', 'revoked', 'expired', 'force_reenroll'].includes(data.reason)) {
            localStorage.removeItem(TRUSTED_TOKEN_KEY);
          }
        } catch { /* network: ignore, fallback to challenge */ }
      }
    })();
    return () => { cancelled = true; };
  }, [onVerified]);

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!factorId || code.length !== 6 || loading) return;
    if (attempts >= MAX_ATTEMPTS) return;

    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        toast.error('Eroare la crearea provocării MFA');
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        const next = attempts + 1;
        setAttempts(next);
        setCode('');
        if (next >= MAX_ATTEMPTS) {
          toast.error('Prea multe încercări greșite. Te rugăm să te deconectezi și să reîncerci.', { duration: 8000 });
        } else {
          toast.error(`Cod incorect. Mai ai ${MAX_ATTEMPTS - next} încercări.`);
        }
        return;
      }

      // Verified — register trusted device if requested
      if (trustDevice) {
        try {
          const { data, error } = await supabase.functions.invoke('mfa-trusted-create', {
            body: {
              friendlyName: navigator.platform || 'Acest dispozitiv',
            },
          });
          if (!error && data?.token) {
            localStorage.setItem(TRUSTED_TOKEN_KEY, data.token);
          }
        } catch { /* non-fatal */ }
      }

      toast.success('Verificare 2FA reușită!');
      onVerified();
    } catch {
      toast.error('Eroare la verificarea codului');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute inset-0 text-primary opacity-[0.35] pointer-events-none">
        <MolecularPattern className="w-full h-full" />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/6 rounded-full blur-3xl animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/6 rounded-full blur-3xl animate-blob animation-delay-2000" />
      </div>

      <Card className="w-full max-w-md relative animate-fade-in glass-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-display">
              {view === 'recovery' ? 'Recuperare 2FA'
                : view === 'reset' ? 'Asistență 2FA'
                : 'Verificare în doi pași'}
            </CardTitle>
            {view === 'challenge' && (
              <CardDescription className="mt-1">
                Introdu codul din 6 cifre din aplicația ta de autentificare
                (Google Authenticator, Microsoft Authenticator, Authy etc.).
                {userEmail && <span className="block mt-1 text-xs">Cont: <span className="font-mono">{userEmail}</span></span>}
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {view === 'recovery' ? (
            <MFARecoveryEntry onBack={() => setView('challenge')} />
          ) : view === 'reset' ? (
            <MFAResetRequestForm onBack={() => setView('challenge')} defaultEmail={userEmail} />
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="mfa-code" className="sr-only">Cod de verificare</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(v) => setCode(v.replace(/\D/g, ''))}
                    disabled={loading || attempts >= MAX_ATTEMPTS}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div className="flex items-start gap-2 px-1">
                <Checkbox
                  id="trust-device"
                  checked={trustDevice}
                  onCheckedChange={(v) => setTrustDevice(v === true)}
                  disabled={loading || attempts >= MAX_ATTEMPTS}
                />
                <Label htmlFor="trust-device" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                  Ai încredere în acest browser timp de <strong className="text-foreground">30 zile</strong>. Folosește
                  doar pe dispozitive personale, ne-partajate.
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="hero"
                disabled={loading || code.length !== 6 || attempts >= MAX_ATTEMPTS}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Verifică
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setView('recovery')}
                  className="text-xs"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                  Cod recuperare
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setView('reset')}
                  className="text-xs"
                >
                  <LifeBuoy className="w-3.5 h-3.5 mr-1.5" />
                  Solicită ajutor
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Ieși din cont
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
