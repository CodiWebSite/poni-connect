import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Clock, Building2, Monitor, Phone } from 'lucide-react';
import AnalogClock from '@/components/kiosk/AnalogClock';
import KioskSidebarWeather from '@/components/kiosk/KioskSidebarWeather';
import KioskSidebarAnnouncements from '@/components/kiosk/KioskSidebarAnnouncements';
import KioskSidebarEvents from '@/components/kiosk/KioskSidebarEvents';
import KioskSidebarRoomBookings from '@/components/kiosk/KioskSidebarRoomBookings';

// ── Date helpers ───────────────────────────────────────
const DAYS_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const MONTHS_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const formatDateRo = (d: Date) => `${DAYS_RO[d.getDay()]}, ${d.getDate()} ${MONTHS_RO[d.getMonth()]} ${d.getFullYear()}`;
const formatTime = (d: Date) => d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

const KIOSK_VIDEO_URL = 'https://icmpp.ro/files/70/INSTITUTUL%20PP%202_final.mp4';

const Kiosk = () => {
  const [now, setNow] = useState(new Date());
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [kioskMessage, setKioskMessage] = useState('');
  const [tickerMessages, setTickerMessages] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
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
    const t = setInterval(fetchSettings, 60_000);
    return () => clearInterval(t);
  }, [fetchSettings]);

  if (!kioskEnabled) {
    return (
      <div className="h-screen w-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-400">Mod Kiosk dezactivat</h1>
          <p className="text-slate-400 mt-2">Ecranul TV este momentan oprit de administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white text-slate-900 flex flex-col overflow-hidden select-none">
      {/* ── Header ─────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <img src="/logo-icmpp.png" alt="ICMPP" className="h-16 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-slate-800 leading-tight">
              Institutul de Chimie Macromoleculară{' '}
              <span className="text-primary">„Petru Poni"</span> Iași
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AnalogClock size={80} />
          <div className="text-right">
            <div className="text-3xl font-mono font-bold tabular-nums text-foreground tracking-wider">
              {formatTime(now)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{formatDateRo(now)}</div>
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
              Prezentare Institut
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
                loop
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
                Mentenanță în curs
              </div>
              <p className="text-xs text-amber-600 mt-1">Platforma este temporar indisponibilă.</p>
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
            {tickerMessages.map((msg, i) => (
              <span key={i} className="inline-flex items-center gap-3 px-6 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {msg}
              </span>
            ))}
            {tickerMessages.map((msg, i) => (
              <span key={`dup-${i}`} className="inline-flex items-center gap-3 px-6 text-sm">
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
            <span className="font-medium">Program: L–V 08:00–16:00</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>Secretariat: <strong>101</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span>IT: <strong>150</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">intranet.icmpp.ro</span>
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
        @keyframes kiosk-slide-in {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .kiosk-fade-in {
          animation: kiosk-fade-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .kiosk-slide-in {
          animation: kiosk-slide-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>
    </div>
  );
};

export default Kiosk;
