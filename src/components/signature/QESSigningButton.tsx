import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink,
  Info,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QESSigningButtonProps {
  documentId: string;
  documentType: 'hr_request' | 'procurement';
  documentContent: string; // Base64 encoded PDF
  signerEmail: string;
  signerName: string;
  reason: string;
  onSigningComplete?: (signatureId: string) => void;
  onSigningFailed?: (error: string) => void;
  disabled?: boolean;
}

interface ProviderStatus {
  configured: boolean;
  name: string;
}

interface ProvidersConfig {
  certsign: ProviderStatus;
  digisign: ProviderStatus;
}

const QESSigningButton = ({
  documentId,
  documentType,
  documentContent,
  signerEmail,
  signerName,
  reason,
  onSigningComplete,
  onSigningFailed,
  disabled = false
}: QESSigningButtonProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [providers, setProviders] = useState<ProvidersConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'certsign' | 'digisign' | null>(null);
  const [signingStatus, setSigningStatus] = useState<'idle' | 'pending' | 'completed' | 'failed'>('idle');
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

  useEffect(() => {
    checkProviderConfig();
  }, []);

  const checkProviderConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('qes-sign', {
        body: { action: 'check-config' }
      });

      if (error) throw error;

      setProviders(data.providers);
      
      // Auto-select first available provider
      if (data.providers.certsign.configured) {
        setSelectedProvider('certsign');
      } else if (data.providers.digisign.configured) {
        setSelectedProvider('digisign');
      }
    } catch (error) {
      console.error('Error checking QES config:', error);
    } finally {
      setCheckingConfig(false);
    }
  };

  const initiateSigning = async () => {
    if (!selectedProvider) {
      toast({
        title: 'Eroare',
        description: 'Selectați un furnizor de semnătură.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setSigningStatus('pending');

    try {
      const { data, error } = await supabase.functions.invoke('qes-sign', {
        body: {
          action: 'initiate-signing',
          documentId,
          documentType,
          documentContent,
          signerEmail,
          signerName,
          reason,
          provider: selectedProvider
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Semnare inițiată',
          description: 'Veți primi un email cu instrucțiuni pentru semnarea documentului.'
        });

        if (data.signingUrl) {
          setSigningUrl(data.signingUrl);
        }

        onSigningComplete?.(data.signatureId);
      } else {
        throw new Error(data.error || 'Eroare la inițierea semnării');
      }
    } catch (error) {
      console.error('QES signing error:', error);
      setSigningStatus('failed');
      const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
      toast({
        title: 'Eroare',
        description: errorMessage,
        variant: 'destructive'
      });
      onSigningFailed?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checkingConfig) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Se verifică configurația...
      </div>
    );
  }

  const anyConfigured = providers?.certsign.configured || providers?.digisign.configured;

  if (!anyConfigured) {
    return (
      <Alert className="bg-warning/10 border-warning/30">
        <Info className="w-4 h-4 text-warning" />
        <AlertDescription className="text-sm">
          <span className="font-medium">Semnătura electronică calificată nu este configurată.</span>
          <br />
          Contactați departamentul IT pentru a configura integrarea cu certSIGN sau DigiSign.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Semnătură Electronică Calificată
        </CardTitle>
        <CardDescription>
          Semnați documentul cu valoare juridică legală conform eIDAS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="flex flex-wrap gap-2">
          {providers?.certsign.configured && (
            <Button
              type="button"
              variant={selectedProvider === 'certsign' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedProvider('certsign')}
              disabled={loading || signingStatus === 'pending'}
            >
              certSIGN
              {selectedProvider === 'certsign' && (
                <CheckCircle2 className="w-4 h-4 ml-1" />
              )}
            </Button>
          )}
          {providers?.digisign.configured && (
            <Button
              type="button"
              variant={selectedProvider === 'digisign' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedProvider('digisign')}
              disabled={loading || signingStatus === 'pending'}
            >
              DigiSign
              {selectedProvider === 'digisign' && (
                <CheckCircle2 className="w-4 h-4 ml-1" />
              )}
            </Button>
          )}
        </div>

        {/* Signing Status */}
        {signingStatus === 'pending' && (
          <div className="flex items-center gap-2 p-3 bg-info/10 rounded-lg border border-info/20">
            <Clock className="w-4 h-4 text-info" />
            <span className="text-sm">
              Semnare în curs. Verificați email-ul pentru instrucțiuni.
            </span>
          </div>
        )}

        {signingStatus === 'completed' && (
          <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-sm">Document semnat cu succes!</span>
          </div>
        )}

        {signingStatus === 'failed' && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm">Semnarea a eșuat. Încercați din nou.</span>
          </div>
        )}

        {/* Signing URL if available */}
        {signingUrl && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(signingUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Deschide pagina de semnare
          </Button>
        )}

        {/* Sign Button */}
        {signingStatus !== 'pending' && signingStatus !== 'completed' && (
          <Button
            onClick={initiateSigning}
            disabled={disabled || loading || !selectedProvider}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Se procesează...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Semnează cu certificat calificat
              </>
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Semnătura calificată are valoare juridică echivalentă cu cea olografă.
        </p>
      </CardContent>
    </Card>
  );
};

export default QESSigningButton;
