import { useEffect, useState } from 'react';

const SeasonalDecoration = () => {
  const [visible, setVisible] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Bună dimineața');
    else if (hour < 18) setGreeting('Bună ziua');
    else setGreeting('Bună seara');
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-border bg-gradient-to-r from-primary/5 via-background to-accent/10 px-5 py-3">
      {/* Subtle dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <span
            key={i}
            className="absolute text-primary/10 animate-pulse"
            style={{
              left: `${15 + i * 22}%`,
              top: `${20 + (i % 2) * 30}%`,
              fontSize: `${8 + (i % 3) * 3}px`,
              animationDelay: `${i * 0.6}s`,
              animationDuration: `${3 + (i % 2)}s`,
            }}
          >
            ◆
          </span>
        ))}
      </div>

      <div className="relative flex items-center gap-4">
        {/* Waving hand */}
        <div className="flex-shrink-0 text-2xl" aria-hidden="true">
          👋
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {greeting}! Bine ai venit pe platformă.
          </p>
        </div>

        <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-lg" aria-hidden="true">
          <span>🏛️</span>
        </div>
      </div>
    </div>
  );
};

export default SeasonalDecoration;
