import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, AlertTriangle, MapPin, Calendar, Clock, Building2, Monitor, Megaphone } from 'lucide-react';
import AnalogClock from '@/components/kiosk/AnalogClock';

// ── Types ──────────────────────────────────────────────
interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string | null;
  is_pinned: boolean | null;
  created_at: string;
}

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
}

interface EventData {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
}

// ── Weather helpers ────────────────────────────────────
const getConditionRo = (code: number): string => {
  if (code === 0) return 'Cer senin';
  if (code <= 3) return 'Parțial noros';
  if (code === 45 || code === 48) return 'Ceață';
  if (code >= 51 && code <= 57) return 'Burniță';
  if (code >= 61 && code <= 67) return 'Ploaie';
  if (code >= 71 && code <= 77) return 'Ninsoare';
  if (code >= 80 && code <= 82) return 'Averse';
  if (code >= 85 && code <= 86) return 'Averse de ninsoare';
  if (code >= 95) return 'Furtună';
  return 'Variabil';
};

const WeatherIcon = ({ code, className }: { code: number; className?: string }) => {
  const cn = className || 'w-14 h-14';
  if (code === 0) return <Sun className={`${cn} text-amber-500`} />;
  if (code <= 3) return <Cloud className={`${cn} text-slate-400`} />;
  if (code >= 95) return <CloudLightning className={`${cn} text-amber-600`} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={`${cn} text-blue-400`} />;
  if (code >= 51 && code <= 82) return <CloudRain className={`${cn} text-blue-500`} />;
  return <Cloud className={`${cn} text-slate-400`} />;
};

// ── Date helpers ───────────────────────────────────────
const DAYS_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const MONTHS_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

const formatDateRo = (d: Date) => `${DAYS_RO[d.getDay()]}, ${d.getDate()} ${MONTHS_RO[d.getMonth()]} ${d.getFullYear()}`;
const formatTime = (d: Date) => d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
const formatEventDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RO[d.getMonth()].substring(0, 3)} · ${formatTime(d)}`;
};

const KIOSK_VIDEO_URL = 'https://icmpp.ro/files/70/INSTITUTUL%20PP%202_final.mp4';
const SIDEBAR_ANN_ROTATE_SEC = 8;

// ── Main component ─────────────────────────────────────
const Kiosk = () => {
  const [now, setNow] = useState(new Date());
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [sidebarAnnIndex, setSidebarAnnIndex] = useState(0);
  const [annFadeKey, setAnnFadeKey] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [kioskMessage, setKioskMessage] = useState('');
  const [tickerMessages, setTickerMessages] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Clock
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

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, priority, is_pinned, created_at')
      .or('is_pinned.eq.true,priority.eq.urgent')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setAnnouncements(data);
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, location')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(5);
    if (data) setEvents(data);
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

  // Fetch weather
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=47.1585&longitude=27.6014&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Europe%2FBucharest'
      );
      const data = await res.json();
      const c = data.current;
      setWeather({
        temperature: Math.round(c.temperature_2m),
        condition: getConditionRo(c.weather_code),
        humidity: c.relative_humidity_2m,
        windSpeed: Math.round(c.wind_speed_10m),
        weatherCode: c.weather_code,
      });
    } catch {}
  }, []);

  // Initial + polling
  useEffect(() => {
    fetchAnnouncements();
    fetchEvents();
    fetchSettings();
    fetchWeather();
    const poll = setInterval(() => { fetchAnnouncements(); fetchEvents(); fetchSettings(); }, 60_000);
    const weatherPoll = setInterval(fetchWeather, 10 * 60_000);
    return () => { clearInterval(poll); clearInterval(weatherPoll); };
  }, [fetchAnnouncements, fetchEvents, fetchSettings, fetchWeather]);

  // Sidebar announcements auto-rotate
  useEffect(() => {
    if (announcements.length <= 1) return;
    const t = setInterval(() => {
      setSidebarAnnIndex(p => (p + 1) % announcements.length);
      setAnnFadeKey(k => k + 1);
    }, SIDEBAR_ANN_ROTATE_SEC * 1000);
    return () => clearInterval(t);
  }, [announcements.length]);

  // Kiosk disabled screen
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

  const currentSidebarAnn = announcements[sidebarAnnIndex] || null;

  return (
    <div className="h-screen w-screen bg-white text-slate-900 flex flex-col overflow-hidden select-none">
      {/* ── Header ─────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <img src="/logo-icmpp.png" alt="ICMPP" className="h-20 w-auto" />
          <div>
            <h1 className="text-3xl font-bold tracking-wide text-slate-800 leading-tight">
              Institutul de Chimie Macromoleculară<br />
              <span className="text-primary">„Petru Poni"</span> Iași
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <AnalogClock size={100} />
          <div className="text-right">
            <div className="text-4xl font-mono font-bold tabular-nums text-foreground tracking-wider">
              {formatTime(now)}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">{formatDateRo(now)}</div>
          </div>
        </div>
      </header>

      {/* ── Custom Kiosk Message ───────────────── */}
      {kioskMessage && (
        <div className="px-8 py-3 bg-primary/10 border-b border-primary/20 shrink-0">
          <p className="text-sm text-primary text-center font-medium">{kioskMessage}</p>
        </div>
      )}

      {/* ── Main Grid ──────────────────────────── */}
      <main className="flex-1 grid grid-cols-3 gap-0 min-h-0">
        {/* Left 2/3 — Video (loops continuously) */}
        <section className="col-span-2 flex flex-col border-r border-slate-200">
          <div className="px-8 pt-6 pb-3 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Prezentare Institut
            </h2>
          </div>

          <div className="flex-1 px-8 pb-6 flex items-center justify-center min-h-0">
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
        <aside className="flex flex-col divide-y divide-slate-200 min-h-0 bg-slate-50">
          {/* Weather */}
          <div className="p-6 shrink-0">
            {weather ? (
              <div className="flex items-center gap-4">
                <WeatherIcon code={weather.weatherCode} />
                <div>
                  <div className="text-5xl font-bold tabular-nums text-slate-800">{weather.temperature}°C</div>
                  <p className="text-slate-500 text-sm mt-1">{weather.condition}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-blue-500" />{weather.humidity}%</span>
                    <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-slate-400" />{weather.windSpeed} km/h</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">Se încarcă meteo...</div>
            )}
            <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
              <MapPin className="w-3 h-3" /> Iași, România
            </div>
          </div>

          {/* Events */}
          <div className="p-6 flex-1 min-h-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Evenimente
            </h3>
            {events.length > 0 ? (
              <ul className="space-y-3">
                {events.slice(0, 4).map(ev => (
                  <li key={ev.id} className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                    <p className="text-sm font-medium text-slate-700 line-clamp-1">{ev.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatEventDate(ev.start_date)}</p>
                    {ev.location && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 text-sm">Niciun eveniment programat.</p>
            )}
          </div>

          {/* Announcements in sidebar */}
          {announcements.length > 0 && (
            <div className="p-6 shrink-0 overflow-hidden">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Megaphone className="w-4 h-4" /> Anunțuri
                {announcements.length > 1 && (
                  <span className="text-xs text-slate-400 font-normal ml-auto tabular-nums">
                    {sidebarAnnIndex + 1}/{announcements.length}
                  </span>
                )}
              </h3>
              <div key={`ann-${annFadeKey}`} className="kiosk-slide-in">
                {currentSidebarAnn && (
                  <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                    {currentSidebarAnn.priority === 'urgent' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold uppercase tracking-wider mb-2">
                        <AlertTriangle className="w-3 h-3" /> Urgent
                      </span>
                    )}
                    <p className="text-sm font-medium text-slate-700 line-clamp-2">{currentSidebarAnn.title}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">{currentSidebarAnn.content}</p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      {new Date(currentSidebarAnn.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
              {/* Progress dots */}
              {announcements.length > 1 && (
                <div className="flex gap-1.5 mt-2 justify-center">
                  {announcements.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === sidebarAnnIndex ? 'bg-primary' : 'bg-slate-300'}`} />
                  ))}
                </div>
              )}
            </div>
          )}

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
      <footer className="flex items-center justify-between px-8 py-3 bg-white border-t border-slate-200 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Program: L–V 08:00 – 16:00
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          intranet.icmpp.ro
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
