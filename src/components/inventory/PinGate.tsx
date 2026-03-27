import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';

interface PinGateProps {
  equipmentId: string;
  onUnlock: () => void;
}

const PinGate = ({ equipmentId, onUnlock }: PinGateProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-inventory-pin', {
        body: { equipment_id: equipmentId, pin },
      });

      if (fnError || !data?.success) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          setLocked(true);
          setError('Prea multe încercări. Accesul a fost blocat temporar.');
        } else {
          setError(`PIN incorect. Mai ai ${3 - newAttempts} încercări.`);
        }
        setPin('');
      } else {
        onUnlock();
      }
    } catch {
      setError('Eroare de conectare. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-lg">Acces securizat</CardTitle>
          <p className="text-sm text-muted-foreground">Introdu PIN-ul pentru a vizualiza detaliile echipamentului</p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {locked ? (
            <div className="text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive font-medium">Acces blocat temporar</p>
              <p className="text-xs text-muted-foreground">Încearcă din nou în 15 minute sau contactează administratorul.</p>
            </div>
          ) : (
            <>
              <InputOTP maxLength={6} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {error}
                </p>
              )}

              <Button onClick={handleVerify} disabled={pin.length < 4 || loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Verifică PIN
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PinGate;
