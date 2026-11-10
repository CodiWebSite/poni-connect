import { useEffect, useState } from 'react';

const TZ = 'Europe/Bucharest';

export const greetingForHour = (hour: number) =>
  hour >= 5 && hour < 12 ? 'Bună dimineața' : hour >= 12 && hour < 18 ? 'Bună ziua' : 'Bună seara';

const AuthGreeting = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ }).format(now));
  const date = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(now);
  const time = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(now);
  return (
    <div>
      <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        {date} · {time}
      </p>
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
        {greetingForHour(hour)}<span className="text-primary">.</span>
      </h2>
      <p className="mt-1.5 text-muted-foreground">Autentifică-te pentru a accesa platforma.</p>
    </div>
  );
};

export default AuthGreeting;
