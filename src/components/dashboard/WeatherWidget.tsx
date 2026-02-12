import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Loader2 } from 'lucide-react';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getConditionFromCode = (code: number): { text: string; iconCode: string } => {
    if (code === 0) return { text: 'Cer senin', iconCode: '113' };
    if (code <= 3) return { text: 'Parțial noros', iconCode: '116' };
    if (code === 45 || code === 48) return { text: 'Ceață', iconCode: '122' };
    if (code >= 51 && code <= 57) return { text: 'Burniță', iconCode: '176' };
    if (code >= 61 && code <= 67) return { text: 'Ploaie', iconCode: '302' };
    if (code >= 71 && code <= 77) return { text: 'Ninsoare', iconCode: '338' };
    if (code >= 80 && code <= 82) return { text: 'Averse', iconCode: '356' };
    if (code >= 85 && code <= 86) return { text: 'Averse de ninsoare', iconCode: '371' };
    if (code >= 95 && code <= 99) return { text: 'Furtună', iconCode: '200' };
    return { text: 'Variabil', iconCode: '116' };
  };

  const fetchWeather = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=47.1585&longitude=27.6014&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Europe%2FBucharest'
      );

      if (!response.ok) throw new Error('Failed to fetch weather');

      const data = await response.json();
      const current = data.current;
      const condition = getConditionFromCode(current.weather_code);

      setWeather({
        temperature: Math.round(current.temperature_2m),
        condition: condition.text,
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        icon: condition.iconCode,
      });
      setError(null);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Nu s-a putut încărca vremea');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (code: string) => {
    const codeNum = parseInt(code);
    if (codeNum === 113) return <Sun className="w-8 h-8 text-warning" />;
    if (codeNum >= 116 && codeNum <= 122) return <Cloud className="w-8 h-8 text-muted-foreground" />;
    if (codeNum >= 176 && codeNum <= 377) return <CloudRain className="w-8 h-8 text-info" />;
    if (codeNum >= 200 && codeNum <= 232) return <CloudLightning className="w-8 h-8 text-warning" />;
    if (codeNum >= 320 && codeNum <= 395) return <CloudSnow className="w-8 h-8 text-info" />;
    return <Cloud className="w-8 h-8 text-muted-foreground" />;
  };

  const getTemperatureColor = (temp: number) => {
    if (temp <= 0) return 'text-info';
    if (temp <= 10) return 'text-info';
    if (temp <= 20) return 'text-success';
    if (temp <= 30) return 'text-warning';
    return 'text-destructive';
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground text-center">{error || 'Datele meteo nu sunt disponibile'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {getWeatherIcon(weather.icon)}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${getTemperatureColor(weather.temperature)}`}>
                {weather.temperature}°C
              </span>
              <span className="text-xs text-muted-foreground">Iași</span>
            </div>
            <p className="text-xs text-muted-foreground capitalize">{weather.condition}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-info" />
            <span className="text-xs text-muted-foreground">{weather.humidity}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{weather.windSpeed} km/h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherWidget;
