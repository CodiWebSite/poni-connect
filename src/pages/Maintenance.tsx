import { useState, useEffect } from 'react';
import { Wrench, Mail, Phone } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!targetDate) { setTimeLeft(null); return; }

    const update = () => {
      const target = new Date(targetDate).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft(null);
        return;
      }

      setExpired(false);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return { timeLeft, expired };
}

const TimeUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-card border border-border rounded-lg w-16 h-16 flex items-center justify-center shadow-sm">
      <span className="text-2xl font-bold text-foreground tabular-nums">{String(value).padStart(2, '0')}</span>
    </div>
    <span className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">{label}</span>
  </div>
);

const Maintenance = () => {
  const { settings } = useAppSettings();
  const { timeLeft, expired } = useCountdown(settings.maintenance_eta);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-indigo-50 dark:from-slate-900 dark:via-background dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-lg text-center space-y-6">
        {/* Logo institut */}
        <div className="flex justify-center">
          <img 
            src="/logo-icmpp.png" 
            alt="Logo ICMPP" 
            className="h-20 w-auto opacity-90"
          />
        </div>

        {/* Animated wrench icon */}
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
          <Wrench className="w-10 h-10 text-primary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">
            Revenim în curând! 🔧
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Platforma intranet este momentan în proces de actualizare pentru a vă oferi o experiență mai bună.
          </p>
        </div>

        {/* Countdown timer */}
        {timeLeft && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Timp estimat de revenire:</p>
            <div className="flex items-center justify-center gap-3">
              {timeLeft.days > 0 && <TimeUnit value={timeLeft.days} label="zile" />}
              <TimeUnit value={timeLeft.hours} label="ore" />
              <TimeUnit value={timeLeft.minutes} label="min" />
              <TimeUnit value={timeLeft.seconds} label="sec" />
            </div>
          </div>
        )}

        {expired && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
            <p className="text-sm text-primary font-medium">
              Lucrările ar fi trebuit să se termine — reîncărcați pagina sau reveniți în câteva minute.
            </p>
          </div>
        )}

        {/* Friendly card */}
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Lucrăm la îmbunătățiri importante. Vă rugăm să reveniți{!timeLeft && !expired ? ' în câteva minute' : ''}.
          </p>
          
          <div className="h-px bg-border" />

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Aveți nevoie urgentă de asistență?</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-primary" />
                Departamentul IT
              </span>
              <span className="hidden sm:inline text-border">•</span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-primary" />
                Interior 123
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Institutul de Chimie Macromoleculară „Petru Poni" — Iași
        </p>
      </div>
    </div>
  );
};

export default Maintenance;
