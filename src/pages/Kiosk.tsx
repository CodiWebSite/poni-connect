import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Clock, Building2, Monitor, Phone } from 'lucide-react';
import AnalogClock from '@/components/kiosk/AnalogClock';
import KioskRotatingSidebar from '@/components/kiosk/KioskRotatingSidebar';

// ── i18n helpers ───────────────────────────────────────
const DAYS_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const MONTHS_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Lang = 'ro' | 'en';

const t = {
  ro: {
    instituteName: 'Institutul de Chimie Macromoleculară',
    instituteAccent: '„Petru Poni"',
    instituteCity: 'Iași',
    presentationLabel: 'Prezentare Institut',
    maintenanceTitle: 'Mentenanță în curs',
    maintenanceDesc: 'Platforma este temporar indisponibilă.',
    disabledTitle: 'Mod Kiosk dezactivat',
    disabledDesc: 'Ecranul TV este momentan oprit de administrator.',
    schedule: 'Program: L–V 7:30–16:00',
    secretariat: 'Secretariat:',
    address: 'Aleea Grigore Ghica Vodă 41A, 700487 Iași',
    formatDate: (d: Date) => `${DAYS_RO[d.getDay()]}, ${d.getDate()} ${MONTHS_RO[d.getMonth()]} ${d.getFullYear()}`,
  },
  en: {
    instituteName: 'Institute of Macromolecular Chemistry',
    instituteAccent: '"Petru Poni"',
    instituteCity: 'Iași',
    presentationLabel: 'Institute Presentation',
    maintenanceTitle: 'Maintenance in progress',
    maintenanceDesc: 'The platform is temporarily unavailable.',
    disabledTitle: 'Kiosk Mode disabled',
    disabledDesc: 'The TV screen is currently turned off by the administrator.',
    schedule: 'Schedule: Mon–Fri 7:30–16:00',
    secretariat: 'Front Desk:',
    address: 'Aleea Grigore Ghica Vodă 41A, 700487 Iași, Romania',
    formatDate: (d: Date) => `${DAYS_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
  },
};

const formatTime = (d: Date) => d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

const KIOSK_VIDEO_URL = 'https://icmpp.ro/files/70/INSTITUTUL%20PP%202_final.mp4';

const Kiosk = () => {
  const [now, setNow] = useState(new Date());
  const [lang, setLang] = useState<Lang>('ro');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [kioskMessage, setKioskMessage] = useState('');
  const [tickerMessages, setTickerMessages] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const i = t[lang];

  const tickerDuration = useMemo(() => {
    if (tickerMessages.length === 0) return 0;

    const totalChars = tickerMessages.reduce((sum, msg) => sum + msg.length, 0);
    const longestMessage = tickerMessages.reduce((max, msg) => Math.max(max, msg.length), 0);

    return Math.max(
      longestMessage * 0.12,
      totalChars * 0.045,
      tickerMessages.length * 6,
      24
    );
  }, [tickerMessages]);

  // Unregister service worker on kiosk route to avoid stale cache
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister());
      });
    }
  }, []);

  // Toggle language every time the video ends (loops)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleEnded = () => {
      setLang(prev => (prev === 'ro' ? 'en' : 'ro'));
      video.play().catch(() => {});
    };
    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, []);

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Wake Lock
  useEffect(() => {
    let wl: any = null;
    const acquire = async () => {
      try { if ('wakeLock' in navigator) wl = await (navigator as any).wakeLock.request('screen'); } catch {}
    };
    acquire();
    const handler = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', handler);
    return () => { wl?.release(); document.removeEventListener('visibilitychange', handler); };
  }, []);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) {
      const map: Record<string, any> = {};
      data.forEach(r => { map[r.key] = r.value; });

      const nextMaintenanceMode = map.maintenance_mode === true;
      const nextKioskEnabled = map.kiosk_enabled !== false;
      const nextKioskMessage = typeof map.kiosk_message === 'string' ? map.kiosk_message : '';
      const nextTickerMessages = Array.isArray(map.kiosk_ticker_messages)
        ? map.kiosk_ticker_messages.filter((m): m is string => typeof m === 'string')
        : [];

      setMaintenanceMode(nextMaintenanceMode);
      setKioskEnabled(nextKioskEnabled);
      setKioskMessage(nextKioskMessage);
      setTickerMessages(prev =>
        prev.length === nextTickerMessages.length && prev.every((msg, i) => msg === nextTickerMessages[i])
          ? prev
          : nextTickerMessages
      );
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 60_000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  if (!kioskEnabled) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-muted-foreground">{i.disabledTitle}</h1>
          <p className="text-muted-foreground mt-2">{i.disabledDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50 text-foreground flex flex-col overflow-hidden select-none">
      {/* ── Language indicator ─────────────────── */}
      <div className="absolute top-3 right-36 z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full backdrop-blur-sm">
          {lang === 'ro' ? '🇷🇴 RO' : '🇬🇧 EN'}
        </span>
      </div>

      {/* ── Header with gradient ───────────────── */}
      <header className="flex items-center justify-between px-8 py-3 bg-gradient-to-r from-white via-white to-primary/5 border-b border-slate-200/80 shrink-0 relative">
        {/* Subtle top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
        
        <div className="flex items-center gap-4">
          <img src="/logo-icmpp.png" alt="ICMPP" className="h-16 w-auto drop-shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-slate-800 leading-tight">
              {i.instituteName}{' '}
              <span className="text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.3)]">{i.instituteAccent}</span> {i.instituteCity}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AnalogClock size={80} />
          <div className="text-right">
            <div className="text-3xl font-mono font-bold tabular-nums text-foreground tracking-wider">
              {formatTime(now)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{i.formatDate(now)}</div>
          </div>
        </div>
      </header>

      {/* ── Custom Kiosk Message ───────────────── */}
      {kioskMessage && (
        <div className="px-8 py-2 bg-primary/10 border-b border-primary/20 shrink-0 backdrop-blur-sm">
          <p className="text-sm text-primary text-center font-medium">{kioskMessage}</p>
        </div>
      )}

      {/* ── Main Grid ──────────────────────────── */}
      <main className="flex-1 grid grid-cols-3 gap-0 min-h-0">
        {/* Left 2/3 — Video */}
        <section className="col-span-2 flex flex-col relative">
          <div className="px-8 pt-4 pb-2 flex items-center shrink-0">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
              {i.presentationLabel}
            </h2>
          </div>
          <div className="flex-1 px-8 pb-4 flex items-center justify-center min-h-0">
            <div className="w-full h-full flex items-center justify-center kiosk-fade-in">
              <video
                ref={videoRef}
                src={KIOSK_VIDEO_URL}
                muted
                playsInline
                autoPlay
                className="max-w-full max-h-full rounded-xl shadow-2xl ring-1 ring-black/5"
              />
            </div>
          </div>

          {/* ── Animated vertical separator ────── */}
          <div className="absolute top-0 right-0 bottom-0 w-[2px]">
            <div className="h-full w-full kiosk-separator" />
          </div>
        </section>

        {/* Right 1/3 — Rotating Sidebar */}
        <aside className="min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 overflow-hidden relative">
          {/* Subtle glow effect at top */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
          
          <KioskRotatingSidebar />

          {/* Maintenance banner */}
          {maintenanceMode && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-amber-50/95 border-t border-amber-200 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                {i.maintenanceTitle}
              </div>
              <p className="text-xs text-amber-600 mt-1">{i.maintenanceDesc}</p>
            </div>
          )}
        </aside>
      </main>

      {/* ── Ticker ───────────────────────────── */}
      {tickerMessages.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden shrink-0 relative" style={{ height: 36 }}>
          {/* Ticker glow line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div
            className="flex w-max min-w-max items-center whitespace-nowrap h-full will-change-transform"
            style={{
              animation: `ticker-scroll ${tickerDuration}s linear infinite`,
            }}
          >
            {tickerMessages.map((msg, idx) => (
              <span key={idx} className="inline-flex items-center gap-3 px-6 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_4px_hsl(var(--primary)/0.6)] shrink-0" />
                {msg}
              </span>
            ))}
            {tickerMessages.map((msg, idx) => (
              <span key={`dup-${idx}`} className="inline-flex items-center gap-3 px-6 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_4px_hsl(var(--primary)/0.6)] shrink-0" />
                {msg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer with gradient ───────────────── */}
      <footer className="flex items-center justify-between px-8 py-2.5 bg-gradient-to-r from-slate-800 via-slate-800 to-slate-900 text-slate-300 text-xs shrink-0 relative">
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{i.schedule}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{i.secretariat} <strong className="text-slate-200">0332 880 220</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-primary/80">pponi@icmpp.ro</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">{i.address}</span>
        </div>
      </footer>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes kiosk-fade-in {
          0% { opacity: 0; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kiosk-fade-in {
          animation: kiosk-fade-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes kiosk-separator-flow {
          0% { background-position: 0% 0%; }
          100% { background-position: 0% 200%; }
        }
        .kiosk-separator {
          background: linear-gradient(
            180deg,
            transparent 0%,
            hsl(var(--primary) / 0.15) 20%,
            hsl(var(--primary) / 0.4) 50%,
            hsl(var(--primary) / 0.15) 80%,
            transparent 100%
          );
          background-size: 100% 200%;
          animation: kiosk-separator-flow 4s ease-in-out infinite;
        }
        .kiosk-slide-in {
          animation: kiosk-slide-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes kiosk-slide-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Kiosk;
