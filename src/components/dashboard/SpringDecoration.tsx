import { useEffect, useState } from 'react';
import { Clock, Sparkles } from 'lucide-react';

const motivationalMessages = [
  'Fiecare zi e o oportunitate nouă.',
  'Succesul vine din perseverență.',
  'Împreună construim lucruri extraordinare.',
  'Concentrează-te pe ceea ce contează.',
  'Fii schimbarea pe care vrei să o vezi.',
  'Progresul bate perfecțiunea.',
  'O echipă puternică, rezultate puternice.',
];

const SeasonalDecoration = () => {
  const [visible, setVisible] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [motivational, setMotivational] = useState('');

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting('Bună dimineața');
    else if (hour < 18) setGreeting('Bună ziua');
    else setGreeting('Bună seara');

    setTimeStr(now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }));

    // Pick a daily motivational message based on day of year
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    setMotivational(motivationalMessages[dayOfYear % motivationalMessages.length]);

    setVisible(true);

    const interval = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-border/40 bg-gradient-to-r from-primary/[0.06] via-card to-accent/[0.06] px-5 py-4 shadow-card backdrop-blur-sm">
      {/* Animated gradient orb */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl animate-float-subtle pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-gradient-to-tr from-accent/8 to-primary/8 blur-xl animate-float-subtle pointer-events-none" style={{ animationDelay: '1.5s' }} />

      <div className="relative flex items-center gap-4">
        {/* Icon with gradient background */}
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {greeting}! Bine ai venit pe platformă.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">
            „{motivational}"
          </p>
        </div>

        {/* Time display */}
        <div className="flex-shrink-0 hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-1.5 border border-border/40">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium tabular-nums">{timeStr}</span>
        </div>
      </div>
    </div>
  );
};

export default SeasonalDecoration;
