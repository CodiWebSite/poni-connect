import { Info, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';

const DashboardAlertsBanner = () => {
  const { settings } = useAppSettings();
  const [dismissed, setDismissed] = useState(false);

  if (!settings.homepage_message || dismissed) return null;

  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 animate-fade-in relative">
      <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
      <p className="text-xs md:text-sm text-foreground whitespace-pre-line pr-6">{settings.homepage_message}</p>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default DashboardAlertsBanner;
