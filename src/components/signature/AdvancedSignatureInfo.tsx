import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  FileSignature, 
  ExternalLink, 
  Info,
  CheckCircle2,
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdvancedSignatureInfoProps {
  showIntegrationOptions?: boolean;
}

const AdvancedSignatureInfo = ({ showIntegrationOptions = true }: AdvancedSignatureInfoProps) => {
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [configuredProviders, setConfiguredProviders] = useState<{ certsign: boolean; digisign: boolean }>({
    certsign: false,
    digisign: false
  });

  useEffect(() => {
    checkProviderConfig();
  }, []);

  const checkProviderConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('qes-sign', {
        body: { action: 'check-config' }
      });

      if (!error && data?.providers) {
        setConfiguredProviders({
          certsign: data.providers.certsign?.configured || false,
          digisign: data.providers.digisign?.configured || false
        });
      }
    } catch (err) {
      console.error('Error checking QES config:', err);
    } finally {
      setCheckingConfig(false);
    }
  };

  const anyConfigured = configuredProviders.certsign || configuredProviders.digisign;

  const signatureProviders = [
    {
      name: 'certsign',
      label: 'certSIGN',
      url: 'https://www.certsign.ro',
      description: 'Furnizor acreditat de servicii de certificare în România',
      features: ['Semnătură electronică calificată', 'Validare juridică', 'Compatibilitate eIDAS'],
    },
    {
      name: 'digisign',
      label: 'DigiSign',
      url: 'https://www.digisign.ro',
      description: 'Soluții complete de semnătură digitală',
      features: ['Certificate calificate', 'Semnătură în cloud', 'Integrare API'],
    },
    {
      name: 'transsped',
      label: 'Trans Sped',
      url: 'https://www.transsped.ro',
      description: 'Servicii de certificare și semnătură electronică',
      features: ['Certificat pe token USB', 'Semnătură PDF', 'Suport tehnic dedicat'],
    },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Semnătură Electronică Avansată
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-info/10 rounded-lg border border-info/20">
          <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">
              Ce este semnătura electronică calificată?
            </p>
            <p className="text-muted-foreground">
              Semnătura electronică calificată (QES) are aceeași valoare juridică ca semnătura olografă, 
              fiind conformă cu Regulamentul eIDAS al UE și legislația românească.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Avantajele semnăturii calificate
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1 pl-6">
            <li>• Valabilitate juridică identică cu semnătura de mână</li>
            <li>• Recunoaștere în toate statele membre UE</li>
            <li>• Garantarea integrității documentelor</li>
            <li>• Imposibilitatea repudierii (non-repudiation)</li>
            <li>• Marcaj temporal certificat</li>
          </ul>
        </div>

        {/* Integration Status */}
        {checkingConfig ? (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Se verifică integrarea...</span>
          </div>
        ) : anyConfigured ? (
          <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">
                Semnătura calificată este activă
              </p>
              <p className="text-muted-foreground">
                Furnizori configurați: {configuredProviders.certsign && 'certSIGN'}{configuredProviders.certsign && configuredProviders.digisign && ', '}{configuredProviders.digisign && 'DigiSign'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">
                Integrare neactivată
              </p>
              <p className="text-muted-foreground">
                Pentru a activa semnătura calificată, contactați IT pentru configurarea credențialelor API.
              </p>
            </div>
          </div>
        )}

        {showIntegrationOptions && (
          <>
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Furnizori acreditați în România
              </h4>
              <div className="space-y-3">
                {signatureProviders.map((provider) => {
                  const isConfigured = configuredProviders[provider.name as keyof typeof configuredProviders];
                  return (
                    <div 
                      key={provider.name}
                      className={`p-3 border rounded-lg transition-colors ${isConfigured ? 'border-success/50 bg-success/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{provider.label}</span>
                            <Badge variant="outline" className="text-xs">
                              Acreditat
                            </Badge>
                            {isConfigured && (
                              <Badge className="text-xs bg-success text-success-foreground">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Activ
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {provider.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {provider.features.map((feature, idx) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="text-xs bg-muted"
                              >
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="flex-shrink-0"
                          onClick={() => window.open(provider.url, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!anyConfigured && (
              <div className="flex items-start gap-3 p-3 bg-info/10 rounded-lg border border-info/20">
                <FileSignature className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">
                    Cum se configurează?
                  </p>
                  <p className="text-muted-foreground">
                    1. Contactați furnizorul pentru contract API<br />
                    2. Obțineți credențialele (API Key + Secret)<br />
                    3. Administratorul IT le adaugă în sistem
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdvancedSignatureInfo;
