import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Fingerprint } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  isBiometricSupported,
  isBiometricEnabled,
  unlockWithBiometric,
} from '@/native/biometric';

/**
 * Renders a "Deblochează cu amprenta" button on the Auth page,
 * but only inside the native Android app AND only if the user already enabled biometric.
 */
export function BiometricUnlockButton({ onSuccess }: { onSuccess?: () => void }) {
  const supported = isBiometricSupported();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    isBiometricEnabled().then(setEnabled);
  }, [supported]);

  if (!supported || !enabled) return null;

  const handleUnlock = async () => {
    setBusy(true);
    const r = await unlockWithBiometric();
    setBusy(false);
    if (r.ok) {
      toast({ title: 'Autentificat', description: 'Bine ai revenit!' });
      onSuccess?.();
    } else {
      toast({ title: 'Autentificare eșuată', description: r.error, variant: 'destructive' });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleUnlock}
      disabled={busy}
    >
      <Fingerprint className="w-4 h-4 mr-2" />
      Deblochează cu amprenta
    </Button>
  );
}
