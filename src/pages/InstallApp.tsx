import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Smartphone, Monitor, Share, MoreVertical, Plus, ChevronRight, Check, Laptop } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Listen for install prompt (Chrome/Edge/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <MainLayout title="Instalează Aplicația" description="Adaugă ICMPP Intranet pe ecranul tău">
      <div className="max-w-2xl mx-auto space-y-6">

        {isInstalled ? (
          <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Aplicația este instalată! ✅</h2>
              <p className="text-sm text-muted-foreground">
                ICMPP Intranet este deja pe ecranul tău. O poți deschide ca orice altă aplicație.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Hero */}
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto shadow-lg">
                  <img src="/pwa-192x192.png" alt="ICMPP" className="w-16 h-16 rounded-xl" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">ICMPP Intranet</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Instalează platforma ca aplicație nativă — acces instant de pe ecranul telefonului sau desktopului.
                  </p>
                </div>

                {deferredPrompt && (
                  <Button size="lg" onClick={handleInstall} className="gap-2 w-full sm:w-auto">
                    <Download className="w-5 h-5" />
                    Instalează acum
                  </Button>
                )}

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Badge variant="secondary" className="gap-1">
                    <Smartphone className="w-3 h-3" /> Android
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Smartphone className="w-3 h-3" /> iPhone
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Monitor className="w-3 h-3" /> Desktop
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">De ce să instalezi?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {[
                    { emoji: '⚡', title: 'Acces instant', desc: 'Deschide platforma direct de pe ecranul principal, fără browser.' },
                    { emoji: '📱', title: 'Experiență nativă', desc: 'Arată și funcționează ca o aplicație reală — ecran complet, fără bara browserului.' },
                    { emoji: '🔔', title: 'Mereu la zi', desc: 'Se actualizează automat cu ultimele funcționalități.' },
                    { emoji: '🚀', title: 'Încărcare rapidă', desc: 'Resurse salvate local — se deschide mai repede decât din browser.' },
                  ].map(b => (
                    <div key={b.title} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                      <span className="text-2xl">{b.emoji}</span>
                      <div>
                        <p className="font-medium text-sm text-foreground">{b.title}</p>
                        <p className="text-xs text-muted-foreground">{b.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cum instalez?</CardTitle>
                <CardDescription>Alege dispozitivul tău</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Android */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                      <Smartphone className="w-3 h-3 mr-1" /> Android (Chrome)
                    </Badge>
                  </div>
                  <ol className="space-y-2 text-sm text-muted-foreground ml-1">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Apasă pe <strong>meniul ⋮</strong> (cele 3 puncte) din colțul din dreapta-sus al Chrome.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Selectează <strong>„Adaugă pe ecranul de pornire"</strong> sau <strong>„Instalează aplicația"</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Confirmă apăsând <strong>„Instalează"</strong>. Gata! Iconița apare pe ecranul principal.</span>
                    </li>
                  </ol>
                </div>

                {/* iOS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20">
                      <Smartphone className="w-3 h-3 mr-1" /> iPhone / iPad (Safari)
                    </Badge>
                  </div>
                  <ol className="space-y-2 text-sm text-muted-foreground ml-1">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Deschide pagina în <strong>Safari</strong> (nu funcționează din Chrome pe iOS).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Apasă pe <strong>butonul Share</strong> <Share className="w-3.5 h-3.5 inline text-primary" /> (săgeata în sus din bara de jos).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Derulează și apasă <strong>„Adaugă pe ecranul principal"</strong> <Plus className="w-3.5 h-3.5 inline text-primary" />.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>Confirmă cu <strong>„Adaugă"</strong>. Aplicația apare pe ecranul de pornire!</span>
                    </li>
                  </ol>
                </div>

                {/* Desktop Windows/Linux */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20">
                      <Monitor className="w-3 h-3 mr-1" /> Windows / Linux (Chrome / Edge)
                    </Badge>
                  </div>
                  <ol className="space-y-2 text-sm text-muted-foreground ml-1">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Caută iconița <strong>de instalare</strong> <Download className="w-3.5 h-3.5 inline text-primary" /> în bara de adrese (dreapta).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Apasă pe ea și confirmă cu <strong>„Instalează"</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Aplicația se deschide într-o fereastră separată, fără bara browserului.</span>
                    </li>
                  </ol>
                </div>

                {/* macOS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20">
                      <Laptop className="w-3 h-3 mr-1" /> MacBook / macOS
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground italic ml-1 mb-2">Varianta 1 — Chrome / Edge (recomandat)</p>
                  <ol className="space-y-2 text-sm text-muted-foreground ml-1">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Deschide platforma în <strong>Chrome</strong> sau <strong>Edge</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Caută iconița de instalare <Download className="w-3.5 h-3.5 inline text-primary" /> în bara de adrese (dreapta) și apasă pe ea.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Confirmă cu <strong>„Instalează"</strong>. Aplicația apare în <strong>Launchpad</strong> și Dock.</span>
                    </li>
                  </ol>

                  <p className="text-xs text-muted-foreground italic ml-1 mb-2 mt-4">Varianta 2 — Safari (macOS Sonoma 14+ / Safari 17+)</p>
                  <ol className="space-y-2 text-sm text-muted-foreground ml-1">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Deschide platforma în <strong>Safari</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Din meniul Safari, alege <strong>File → Add to Dock</strong> (sau „Fișier → Adaugă în Dock").</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Aplicația apare în <strong>Dock</strong> și se deschide într-o fereastră dedicată, fără bara Safari.</span>
                    </li>
                  </ol>
                  <p className="text-xs text-amber-600 dark:text-amber-400 ml-1 mt-2">
                    ⚠️ Dacă ai o versiune mai veche de macOS (sub Sonoma 14), Safari nu suportă instalarea — folosește Chrome.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default InstallApp;
