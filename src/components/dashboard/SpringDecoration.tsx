import { useEffect, useState } from 'react';

const SeasonalDecoration = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const now = new Date();
    // Show in summer months: June (5), July (6), August (7)
    if (now.getMonth() >= 5 && now.getMonth() <= 7) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-amber-200/60 dark:border-amber-900/30 bg-gradient-to-r from-sky-50/80 via-amber-50/50 to-sky-50/80 dark:from-sky-950/20 dark:via-amber-950/10 dark:to-sky-950/20 px-5 py-3">
      {/* Floating sun rays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className="absolute text-amber-300/25 dark:text-amber-400/10 animate-pulse"
            style={{
              left: `${8 + i * 18}%`,
              top: `${10 + (i % 3) * 20}%`,
              fontSize: `${10 + (i % 3) * 4}px`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2.5 + (i % 2)}s`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      <div className="relative flex items-center gap-4">
        {/* Sun icon */}
        <div className="flex-shrink-0">
          <svg viewBox="0 0 64 64" className="w-10 h-10 drop-shadow-sm" aria-hidden="true">
            <circle cx="32" cy="32" r="12" fill="hsl(45, 93%, 58%)" />
            <circle cx="30" cy="29" r="4" fill="hsl(45, 93%, 70%)" opacity="0.5" />
            {/* Rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <line
                key={angle}
                x1="32"
                y1="32"
                x2={32 + Math.cos((angle * Math.PI) / 180) * 26}
                y2={32 + Math.sin((angle * Math.PI) / 180) * 26}
                stroke="hsl(45, 93%, 58%)"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.7"
              />
            ))}
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            ☀️ O vară frumoasă și plină de energie!
          </p>
        </div>

        {/* Beach/wave decoration */}
        <div className="flex-shrink-0 hidden sm:block">
          <svg viewBox="0 0 60 50" className="w-12 h-10" aria-hidden="true">
            {/* Waves */}
            <path d="M2 35 Q10 28 18 35 Q26 42 34 35 Q42 28 50 35 Q54 38 58 35" fill="none" stroke="hsl(200, 70%, 55%)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M5 42 Q13 35 21 42 Q29 49 37 42 Q45 35 53 42" fill="none" stroke="hsl(200, 70%, 65%)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            {/* Palm leaf */}
            <path d="M22 32 Q18 15 10 8" fill="none" stroke="hsl(130, 50%, 40%)" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 8 Q6 12 14 16" fill="hsl(130, 50%, 45%)" opacity="0.8" />
            <path d="M10 8 Q14 6 18 14" fill="hsl(130, 45%, 50%)" opacity="0.7" />
            <path d="M10 8 Q4 6 8 14" fill="hsl(130, 55%, 42%)" opacity="0.7" />
            {/* Trunk */}
            <path d="M22 32 Q21 28 22 24" fill="none" stroke="hsl(30, 40%, 45%)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SeasonalDecoration;
