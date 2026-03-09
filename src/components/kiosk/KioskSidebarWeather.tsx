import { useEffect, useState, useCallback } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, MapPin } from 'lucide-react';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
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
  if (code >= 85 && code <= 86) return 'Averse de ninsoare';
  if (code >= 95) return 'Furtună';
  return 'Variabil';
};

const WeatherIcon = ({ code, className }: { code: number; className?: string }) => {
  const cn = className || 'w-10 h-10';
  if (code === 0) return <Sun className={`${cn} text-amber-500`} />;
  if (code <= 3) return <Cloud className={`${cn} text-slate-400`} />;
  if (code >= 95) return <CloudLightning className={`${cn} text-amber-600`} />;
  if (code >= 71 && code <= 86) return <CloudSnow className={`${cn} text-blue-400`} />;
  if (code >= 51 && code <= 82) return <CloudRain className={`${cn} text-blue-500`} />;
  return <Cloud className={`${cn} text-slate-400`} />;
};

const KioskSidebarWeather = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);

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

  useEffect(() => {
    fetchWeather();
    const t = setInterval(fetchWeather, 10 * 60_000);
    return () => clearInterval(t);
  }, [fetchWeather]);

  return (
    <div className="p-5 shrink-0">
      {weather ? (
        <div className="flex items-center gap-3">
          <WeatherIcon code={weather.weatherCode} />
          <div>
            <div className="text-4xl font-bold tabular-nums text-slate-800">{weather.temperature}°C</div>
            <p className="text-slate-500 text-xs mt-0.5">{weather.condition}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-500" />{weather.humidity}%</span>
              <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-slate-400" />{weather.windSpeed} km/h</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-slate-400 text-sm">Se încarcă meteo...</div>
      )}
      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
        <MapPin className="w-2.5 h-2.5" /> Iași, România
      </div>
    </div>
  );
};

export default KioskSidebarWeather;
