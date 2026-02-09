import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Thermometer, Loader2 } from 'lucide-react';

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
    // Open-Meteo allows ~10k req/day; refresh every 10 minutes
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
      // Open-Meteo API - free, no API key, generous rate limits
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
    // Weather codes from wttr.in
    if (codeNum === 113) return <Sun className="w-10 h-10 text-yellow-500" />;
    if (codeNum >= 116 && codeNum <= 122) return <Cloud className="w-10 h-10 text-muted-foreground" />;
    if (codeNum >= 176 && codeNum <= 377) return <CloudRain className="w-10 h-10 text-blue-500" />;
    if (codeNum >= 200 && codeNum <= 232) return <CloudLightning className="w-10 h-10 text-yellow-600" />;
    if (codeNum >= 320 && codeNum <= 395) return <CloudSnow className="w-10 h-10 text-blue-200" />;
    return <Cloud className="w-10 h-10 text-muted-foreground" />;
  };

  const getTemperatureColor = (temp: number) => {
    if (temp <= 0) return 'text-blue-400';
    if (temp <= 10) return 'text-blue-500';
    if (temp <= 20) return 'text-green-500';
    if (temp <= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Vremea în Iași
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Vremea în Iași
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {error || 'Datele meteo nu sunt disponibile'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Cloud className="w-5 h-5 text-primary" />
          Vremea în Iași
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getWeatherIcon(weather.icon)}
            <div>
              <p className={`text-3xl font-bold ${getTemperatureColor(weather.temperature)}`}>
                {weather.temperature}°C
              </p>
              <p className="text-sm text-muted-foreground capitalize">
                {weather.condition}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Umiditate</p>
              <p className="text-sm font-medium">{weather.humidity}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Vânt</p>
              <p className="text-sm font-medium">{weather.windSpeed} km/h</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherWidget;
