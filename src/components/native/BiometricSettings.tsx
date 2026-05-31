import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Fingerprint, Smartphone, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  isBiometricSupported,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  checkBiometricAvailability,
} from '@/native/biometric';

export function BiometricSettings() {
  const supported = isBiometricSupported();
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      const a = await checkBiometricAvailability();
      setAvailable(a.available);
      setReason(a.reason);
      setEnabled(await isBiometricEnabled());
    })();
  }, [supported]);

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5" /> Autentificare biometric
          </CardTitle>
          <CardDescription>
            Această funcție este disponibilă doar în aplicația nativă Android pentru ICMPP Intranet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Instalează aplicația ICMPP Intranet pe telefonul tău Android pentru a folosi amprenta sau
              recunoașterea facială la autentificare.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    if (next) {
      const r = await enableBiometric();
      if (r.ok) {
        setEnabled(true);
        toast({ title: 'Biometric activat', description: 'Te poți autentifica cu amprenta.' });
      } else {
        toast({ title: 'Eroare', description: r.error, variant: 'destructive' });
      }
    } else {
      await disableBiometric();
      setEnabled(false);
      toast({ title: 'Biometric dezactivat' });
    }
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5" /> Autentificare biometric
        </CardTitle>
        <CardDescription>
          Folosește amprenta sau recunoașterea facială pentru a te re-autentifica rapid. MFA (cod TOTP)
          rămâne valabil la fiecare 30 zile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!available && (
          <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{reason || 'Biometric indisponibil pe acest dispozitiv.'}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Activează biometric</p>
            <p className="text-sm text-muted-foreground">
              {enabled ? 'Activat — la următorul login se cere amprenta.' : 'Dezactivat'}
            </p>
          </div>
          <Switch checked={enabled} disabled={!available || busy} onCheckedChange={handleToggle} />
        </div>
      </CardContent>
    </Card>
  );
}
