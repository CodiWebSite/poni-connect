import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, KeyRound, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MFARecoveryEntryProps {
  onBack: () => void;
}

/**
 * Allows a user stuck at MFA challenge to consume a single recovery code.
 * On success the user is signed out and redirected to /auth with a flag
 * to force re-enrollment after they sign in again.
 */
export default function MFARecoveryEntry({ onBack }: MFARecoveryEntryProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleaned = code.trim().toUpperCase();
    if (cleaned.replace(/-/g, '').length !== 8) {
      toast.error('Codul trebuie să aibă 8 caractere (format XXXX-XXXX).');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mfa-recovery-consume', {
        body: { code: cleaned },
      });
      if (error || !data?.success) {
        toast.error(data?.error || 'Cod invalid sau deja folosit.');
        setLoading(false);
        return;
      }
      toast.success('Cod acceptat. Vei fi deconectat pentru a reconfigura 2FA.', { duration: 6000 });
      // Sign-out so the next login forces MFA setup again.
      await supabase.auth.signOut();
      window.location.href = '/auth?reenroll=1';
    } catch {
      toast.error('Eroare la verificarea codului.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Înapoi la verificarea în doi pași
      </button>

      <div className="space-y-1">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Cod de recuperare
        </h3>
        <p className="text-sm text-muted-foreground">
          Introdu unul dintre cele 10 coduri de recuperare generate la activarea 2FA.
        </p>
      </div>

      <div className="rounded-md bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-foreground/80 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <span>
          După utilizare, toate codurile rămase și dispozitivele de încredere
          vor fi <strong>invalidate</strong> și va trebui să configurezi 2FA din nou.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="recovery-code">Cod (XXXX-XXXX)</Label>
          <Input
            id="recovery-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))}
            placeholder="A3F9-K2BX"
            autoFocus
            autoComplete="off"
            className="text-center text-lg font-mono tracking-widest"
          />
        </div>
        <Button type="submit" className="w-full" variant="hero" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Folosește codul
        </Button>
      </form>
    </div>
  );
}
