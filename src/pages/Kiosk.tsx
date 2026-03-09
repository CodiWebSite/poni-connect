import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, AlertTriangle, ChevronLeft, ChevronRight, MapPin, Calendar, Clock, Building2, Monitor } from 'lucide-react';

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
  const cn = className || 'w-16 h-16';
  if (code === 0) return <Sun className={`${cn} text-yellow-400`} />;
  if (code <= 3) return <Cloud className={`${cn} text-slate-300`} />;
  if (code >= 95) return <CloudLightning className={`${cn} text-yellow-300`} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={`${cn} text-blue-200`} />;
  if (code >= 51 && code <= 82) return <CloudRain className={`${cn} text-blue-300`} />;
  return <Cloud className={`${cn} text-slate-300`} />;
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

// ── Main component ─────────────────────────────────────
const Kiosk = () => {
  const [now, setNow] = useState(new Date());
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [kioskMessage, setKioskMessage] = useState('');

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Wake Lock
  useEffect(() => {
    let wl: any = null;
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wl = await (navigator as any).wakeLock.request('screen');
        }
      } catch { /* ignore */ }
    };
    acquire();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') acquire();
    });
    return () => { wl?.release(); };
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
    } catch { /* silent */ }
  }, []);

  // Initial + polling
  useEffect(() => {
    fetchAnnouncements();
    fetchEvents();
    fetchSettings();
    fetchWeather();

    const poll = setInterval(() => {
      fetchAnnouncements();
      fetchEvents();
      fetchSettings();
    }, 60_000);

    const weatherPoll = setInterval(fetchWeather, 10 * 60_000);
    return () => { clearInterval(poll); clearInterval(weatherPoll); };
  }, [fetchAnnouncements, fetchEvents, fetchSettings, fetchWeather]);

  // Auto-rotate announcements with fade
  useEffect(() => {
    if (announcements.length <= 1) return;
    const t = setInterval(() => {
      setCurrentSlide(p => (p + 1) % announcements.length);
      setFadeKey(k => k + 1);
    }, 10_000);
    return () => clearInterval(t);
  }, [announcements.length]);

  const currentAnnouncement = announcements[currentSlide];

  // Kiosk disabled screen
  if (!kioskEnabled) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-500">Mod Kiosk dezactivat</h1>
          <p className="text-slate-600 mt-2">Ecranul TV este momentan oprit de administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* ── Header ─────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <img src="/logo-icmpp.png" alt="ICMPP" className="h-12 w-auto brightness-0 invert opacity-90" />
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white/90">ICMPP „Petru Poni" Iași</h1>
            <p className="text-sm text-slate-400">Institutul de Chimie Macromoleculară</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold tabular-nums text-white/95 tracking-wider">
            {formatTime(now)}
          </div>
          <div className="text-sm text-slate-400 mt-0.5">{formatDateRo(now)}</div>
        </div>
      </header>

      {/* ── Custom Kiosk Message ───────────────── */}
      {kioskMessage && (
        <div className="px-8 py-3 bg-blue-600/20 border-b border-blue-500/30 shrink-0">
          <p className="text-sm text-blue-200 text-center font-medium">{kioskMessage}</p>
        </div>
      )}

      {/* ── Main Grid ──────────────────────────── */}
      <main className="flex-1 grid grid-cols-3 gap-0 min-h-0">
        {/* Left 2/3 — Announcements carousel */}
        <section className="col-span-2 flex flex-col border-r border-slate-800">
          <div className="px-8 pt-6 pb-3 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Anunțuri
            </h2>
            {announcements.length > 1 && (
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentSlide(p => (p - 1 + announcements.length) % announcements.length)}
                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-500 tabular-nums">
                  {currentSlide + 1} / {announcements.length}
                </span>
                <button onClick={() => setCurrentSlide(p => (p + 1) % announcements.length)}
                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 px-8 pb-6 flex items-center min-h-0">
            {currentAnnouncement ? (
              <div className="w-full animate-fade-in" key={`slide-${fadeKey}`} style={{ animationDuration: '0.8s' }}>
                {currentAnnouncement.priority === 'urgent' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider mb-4">
                    <AlertTriangle className="w-3.5 h-3.5" /> Urgent
                  </span>
                )}
                <h3 className="text-3xl font-bold text-white leading-tight mb-4">
                  {currentAnnouncement.title}
                </h3>
                <p className="text-lg text-slate-300 leading-relaxed line-clamp-6 whitespace-pre-line">
                  {currentAnnouncement.content}
                </p>
                <p className="text-sm text-slate-600 mt-6">
                  {new Date(currentAnnouncement.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            ) : (
              <p className="text-slate-600 text-xl">Nu există anunțuri de afișat.</p>
            )}
          </div>

          {/* Slide dots */}
          {announcements.length > 1 && (
            <div className="flex justify-center gap-2 pb-4 shrink-0">
              {announcements.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? 'bg-blue-400' : 'bg-slate-700'}`} />
              ))}
            </div>
          )}
        </section>

        {/* Right 1/3 — Sidebar */}
        <aside className="flex flex-col divide-y divide-slate-800 min-h-0">
          {/* Weather */}
          <div className="p-6 shrink-0">
            {weather ? (
              <div className="flex items-center gap-4">
                <WeatherIcon code={weather.weatherCode} />
                <div>
                  <div className="text-5xl font-bold tabular-nums">{weather.temperature}°C</div>
                  <p className="text-slate-400 text-sm mt-1">{weather.condition}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-blue-400" />{weather.humidity}%</span>
                    <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5" />{weather.windSpeed} km/h</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-600 text-sm">Se încarcă meteo...</div>
            )}
            <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-600">
              <MapPin className="w-3 h-3" /> Iași, România
            </div>
          </div>

          {/* Events */}
          <div className="p-6 flex-1 min-h-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Evenimente
            </h3>
            {events.length > 0 ? (
              <ul className="space-y-3">
                {events.slice(0, 4).map(ev => (
                  <li key={ev.id} className="rounded-lg bg-slate-900/50 border border-slate-800 p-3">
                    <p className="text-sm font-medium text-white/90 line-clamp-1">{ev.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatEventDate(ev.start_date)}</p>
                    {ev.location && <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600 text-sm">Niciun eveniment programat.</p>
            )}
          </div>

          {/* Maintenance banner */}
          {maintenanceMode && (
            <div className="p-4 bg-amber-500/10 border-t border-amber-500/20 shrink-0">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Mentenanță în curs
              </div>
              <p className="text-xs text-amber-500/70 mt-1">Platforma este temporar indisponibilă.</p>
            </div>
          )}
        </aside>
      </main>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="flex items-center justify-between px-8 py-3 bg-slate-900/80 border-t border-slate-800 text-xs text-slate-600 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Program: L–V 08:00 – 16:00
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          intranet.icmpp.ro
        </div>
      </footer>
    </div>
  );
};

export default Kiosk;
