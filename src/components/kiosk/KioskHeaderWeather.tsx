import { useEffect, useState, useCallback } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';

interface WeatherData {
  temperature: number;
  condition: string;
  weatherCode: number;
}

const getConditionRo = (code: number): string => {
  if (code === 0) return 'Cer senin';
  if (code <= 3) return 'Parțial noros';
  if (code === 45 || code === 48) return 'Ceață';
  if (code >= 51 && code <= 57) return 'Burniță';
  if (code >= 61 && code <= 67) return 'Ploaie';
  if (code >= 71 && code <= 77) return 'Ninsoare';
  if (code >= 80 && code <= 82) return 'Averse';
  if (code >= 95) return 'Furtună';
  return 'Variabil';
};

const WeatherIcon = ({ code }: { code: number }) => {
  const cn = 'w-7 h-7';
  if (code === 0) return <Sun className={`${cn} text-amber-500`} />;
  if (code <= 3) return <Cloud className={`${cn} text-slate-400`} />;
  if (code >= 95) return <CloudLightning className={`${cn} text-amber-600`} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={`${cn} text-blue-400`} />;
  if (code >= 51 && code <= 82) return <CloudRain className={`${cn} text-blue-500`} />;
  return <Cloud className={`${cn} text-slate-400`} />;
};

const CYCLE_MS = 5000; // show weather for 5s, then clock for 5s

interface Props {
  formatTime: (d: Date) => string;
  formatDate: (d: Date) => string;
  now: Date;
}

const KioskHeaderWeather = ({ formatTime, formatDate, now }: Props) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showWeather, setShowWeather] = useState(false);

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=47.1585&longitude=27.6014&current=temperature_2m,weather_code&timezone=Europe%2FBucharest'
      );
      const data = await res.json();
      const c = data.current;
      setWeather({
        temperature: Math.round(c.temperature_2m),
        condition: getConditionRo(c.weather_code),
        weatherCode: c.weather_code,
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchWeather();
    const t = setInterval(fetchWeather, 10 * 60_000);
    return () => clearInterval(t);
  }, [fetchWeather]);

  useEffect(() => {
    const t = setInterval(() => setShowWeather(prev => !prev), CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative w-[180px] h-[70px] overflow-hidden">
      {/* Clock view */}
      <div
        className={`absolute inset-0 flex flex-col items-end justify-center transition-all duration-700 ease-in-out ${
          showWeather && weather
            ? 'opacity-0 -translate-y-4 scale-95'
            : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        <div className="text-3xl font-mono font-bold tabular-nums text-foreground tracking-wider">
          {formatTime(now)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{formatDate(now)}</div>
      </div>

      {/* Weather view */}
      {weather && (
        <div
          className={`absolute inset-0 flex items-center justify-end gap-2 transition-all duration-700 ease-in-out ${
            showWeather
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <WeatherIcon code={weather.weatherCode} />
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-slate-800">{weather.temperature}°C</div>
            <p className="text-[11px] text-slate-500">{weather.condition}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KioskHeaderWeather;
