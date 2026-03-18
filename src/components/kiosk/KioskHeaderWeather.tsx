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
  const cn = 'w-6 h-6';
  if (code === 0) return <Sun className={`${cn} text-amber-500`} />;
  if (code <= 3) return <Cloud className={`${cn} text-slate-400`} />;
  if (code >= 95) return <CloudLightning className={`${cn} text-amber-600`} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={`${cn} text-blue-400`} />;
  if (code >= 51 && code <= 82) return <CloudRain className={`${cn} text-blue-500`} />;
  return <Cloud className={`${cn} text-slate-400`} />;
};

interface Props {
  formatTime: (d: Date) => string;
  formatDate: (d: Date) => string;
  now: Date;
}

const KioskHeaderWeather = ({ formatTime, formatDate, now }: Props) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);

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

  return (
    <div className="flex items-center gap-5">
      {/* Clock + Date */}
      <div className="flex flex-col items-end justify-center">
        <div className="text-3xl font-mono font-bold tabular-nums text-foreground tracking-wider leading-none">
          {formatTime(now)}
        </div>
        <div className="text-xs text-muted-foreground mt-1 leading-none">{formatDate(now)}</div>
      </div>

      {/* Weather */}
      {weather && (
        <>
          <div className="w-px h-10 bg-border/50" />
          <div className="flex items-center gap-2">
            <WeatherIcon code={weather.weatherCode} />
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums text-foreground leading-none">{weather.temperature}°C</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{weather.condition}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default KioskHeaderWeather;
