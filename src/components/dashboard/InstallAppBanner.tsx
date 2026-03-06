import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWA_BANNER_DISMISSED = 'icmpp-pwa-banner-dismissed';

const InstallAppBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Already dismissed this session
    if (sessionStorage.getItem(PWA_BANNER_DISMISSED)) {
      setIsDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(PWA_BANNER_DISMISSED, 'true');
  };

  if (isInstalled || isDismissed) return null;

  return (
    <div className="relative rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4 mb-4 animate-fade-in overflow-hidden">
      {/* Dismiss */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        className="absolute top-2 right-2 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </Button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pr-8">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            📲 Instalează ICMPP Intranet ca aplicație!
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Accesează platforma direct de pe ecranul telefonului sau desktopului — fără browser, ca o aplicație reală.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {deferredPrompt ? (
            <Button size="sm" onClick={handleInstall} className="gap-1.5 w-full sm:w-auto">
              <Download className="w-4 h-4" />
              Instalează
            </Button>
          ) : (
            <Button size="sm" asChild className="gap-1.5 w-full sm:w-auto">
              <Link to="/install">
                <Smartphone className="w-4 h-4" />
                Vezi cum se instalează
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Subtle device icons */}
      <div className="flex items-center gap-3 mt-2.5 ml-14 sm:ml-14">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Smartphone className="w-3 h-3" /> Android
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Smartphone className="w-3 h-3" /> iPhone
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Monitor className="w-3 h-3" /> Desktop
        </span>
      </div>
    </div>
  );
};

export default InstallAppBanner;
