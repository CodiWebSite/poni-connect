import { useState, useEffect, useCallback } from 'react';
import { Wrench, Mail, Phone, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    <div className="bg-black/50 backdrop-blur-md border border-white/20 rounded-lg w-16 h-16 flex items-center justify-center shadow-lg">
      <span className="text-2xl font-bold text-white tabular-nums">{String(value).padStart(2, '0')}</span>
    </div>
    <span className="text-xs text-white/80 mt-1.5 uppercase tracking-wider">{label}</span>
  </div>
);

const Maintenance = () => {
  const { settings } = useAppSettings();
  const { timeLeft, expired } = useCountdown(settings.maintenance_eta);
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(30);
  const [checking, setChecking] = useState(false);

  // Auto-redirect when maintenance is turned off (realtime)
  useEffect(() => {
    if (!settings.maintenance_mode) {
      navigate('/', { replace: true });
    }
  }, [settings.maintenance_mode, navigate]);

  // Auto-refresh countdown every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Trigger a visual check pulse
          setChecking(true);
          setTimeout(() => setChecking(false), 1500);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const manualCheck = useCallback(() => {
    setChecking(true);
    setCountdown(30);
    // Settings update automatically via realtime, just show visual feedback
    setTimeout(() => setChecking(false), 1500);
  }, []);
  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url(/images/icmpp-building.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="relative z-10 max-w-lg text-center space-y-6">
        {/* Logo institut */}
        <div className="flex justify-center">
          <img 
            src="/logo-icmpp.png" 
            alt="Logo ICMPP" 
            className="h-20 w-auto brightness-110 drop-shadow-lg"
          />
        </div>

        {/* Animated wrench icon */}
        <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto animate-pulse">
          <Wrench className="w-10 h-10 text-white" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Revenim în curând! 🔧
          </h1>
          <p className="text-lg text-white/90 leading-relaxed drop-shadow">
            Platforma intranet este momentan în proces de actualizare pentru a vă oferi o experiență mai bună.
          </p>
        </div>

        {/* Countdown timer */}
        {timeLeft && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/80">Timp estimat de revenire:</p>
            <div className="flex items-center justify-center gap-3">
              {timeLeft.days > 0 && <TimeUnit value={timeLeft.days} label="zile" />}
              <TimeUnit value={timeLeft.hours} label="ore" />
              <TimeUnit value={timeLeft.minutes} label="min" />
              <TimeUnit value={timeLeft.seconds} label="sec" />
            </div>
          </div>
        )}

        {expired && (
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-lg px-4 py-3">
            <p className="text-sm text-white font-medium">
              Lucrările ar fi trebuit să se termine — reîncărcați pagina sau reveniți în câteva minute.
            </p>
          </div>
        )}

        {/* Friendly card */}
        <div className="bg-black/40 backdrop-blur-md border border-white/15 rounded-xl p-6 space-y-4 shadow-xl">
          <p className="text-sm text-white/85">
            Lucrăm la îmbunătățiri importante. Vă rugăm să reveniți{!timeLeft && !expired ? ' în câteva minute' : ''}.
          </p>
          
          <div className="h-px bg-white/20" />

          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Aveți nevoie urgentă de asistență?</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-white/90" />
                Departamentul IT
              </span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-white/90" />
                Interior 123
              </span>
            </div>
          </div>
        </div>

        {/* Auto-refresh indicator */}
        <button
          onClick={manualCheck}
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition-colors mx-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Se verifică...' : `Verificare automată în ${countdown}s`}
        </button>

        <p className="text-xs text-white/50">
          Institutul de Chimie Macromoleculară „Petru Poni" — Iași
        </p>
      </div>
    </div>
  );
};

export default Maintenance;
