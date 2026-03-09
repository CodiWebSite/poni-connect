import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Clock, Building2, Monitor, Phone } from 'lucide-react';
import AnalogClock from '@/components/kiosk/AnalogClock';
import KioskSidebarWeather from '@/components/kiosk/KioskSidebarWeather';
import KioskSidebarAnnouncements from '@/components/kiosk/KioskSidebarAnnouncements';
import KioskSidebarEvents from '@/components/kiosk/KioskSidebarEvents';
import KioskSidebarRoomBookings from '@/components/kiosk/KioskSidebarRoomBookings';

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
      // Restart playback for the next cycle
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
      setMaintenanceMode(map.maintenance_mode === true);
      setKioskEnabled(map.kiosk_enabled !== false);
      setKioskMessage(typeof map.kiosk_message === 'string' ? map.kiosk_message : '');
      setTickerMessages(Array.isArray(map.kiosk_ticker_messages) ? map.kiosk_ticker_messages : []);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 60_000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  if (!kioskEnabled) {
    return (
      <div className="h-screen w-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-400">{i.disabledTitle}</h1>
          <p className="text-slate-400 mt-2">{i.disabledDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white text-slate-900 flex flex-col overflow-hidden select-none">
      {/* ── Language indicator ─────────────────── */}
      <div className="absolute top-3 right-36 z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {lang === 'ro' ? '🇷🇴 RO' : '🇬🇧 EN'}
        </span>
      </div>

      {/* ── Header ─────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <img src="/logo-icmpp.png" alt="ICMPP" className="h-16 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-slate-800 leading-tight">
              {i.instituteName}{' '}
              <span className="text-primary">{i.instituteAccent}</span> {i.instituteCity}
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
        <div className="px-8 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
          <p className="text-sm text-primary text-center font-medium">{kioskMessage}</p>
        </div>
      )}

      {/* ── Main Grid ──────────────────────────── */}
      <main className="flex-1 grid grid-cols-3 gap-0 min-h-0">
        {/* Left 2/3 — Video */}
        <section className="col-span-2 flex flex-col border-r border-slate-200">
          <div className="px-8 pt-4 pb-2 flex items-center shrink-0">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
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
                className="max-w-full max-h-full rounded-xl shadow-lg"
              />
            </div>
          </div>
        </section>

        {/* Right 1/3 — Sidebar */}
        <aside className="flex flex-col divide-y divide-slate-200 min-h-0 bg-slate-50 overflow-y-auto">
          <KioskSidebarWeather />
          <KioskSidebarAnnouncements />
          <KioskSidebarEvents />
          <KioskSidebarRoomBookings />

          {/* Maintenance banner */}
          {maintenanceMode && (
            <div className="p-4 bg-amber-50 border-t border-amber-200 shrink-0">
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
        <div className="bg-slate-900 text-white overflow-hidden shrink-0" style={{ height: 36 }}>
          <div
            className="flex items-center whitespace-nowrap h-full"
            style={{
              animation: `ticker-scroll ${Math.max(tickerMessages.length * 8, 20)}s linear infinite`,
            }}
          >
            {tickerMessages.map((msg, idx) => (
              <span key={idx} className="inline-flex items-center gap-3 px-6 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {msg}
              </span>
            ))}
            {tickerMessages.map((msg, idx) => (
              <span key={`dup-${idx}`} className="inline-flex items-center gap-3 px-6 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {msg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────── */}
      <footer className="flex items-center justify-between px-8 py-2.5 bg-slate-800 text-slate-300 text-xs shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{i.schedule}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{i.secretariat} <strong>0332 880 220</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span>pponi@icmpp.ro</span>
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
      `}</style>
    </div>
  );
};

export default Kiosk;
