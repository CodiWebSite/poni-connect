import { useEffect, useState } from 'react';

const SpringDecoration = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const now = new Date();
    if (now.getMonth() === 2) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-red-200/60 dark:border-red-900/30 bg-gradient-to-r from-red-50/80 via-white to-red-50/80 dark:from-red-950/20 dark:via-background dark:to-red-950/20 px-5 py-3">
      {/* Floating petals background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className="absolute text-red-300/30 dark:text-red-400/15 animate-pulse"
            style={{
              left: `${10 + i * 16}%`,
              top: `${15 + (i % 3) * 25}%`,
              fontSize: `${10 + (i % 3) * 4}px`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2 + (i % 2)}s`,
            }}
          >
            ✿
          </span>
        ))}
      </div>

      <div className="relative flex items-center gap-4">
        {/* Mărțișor icon */}
        <div className="flex-shrink-0">
          <svg viewBox="0 0 64 80" className="w-10 h-12 drop-shadow-sm" aria-hidden="true">
            {/* Twisted cord */}
            <path d="M32 2 Q35 18 29 32 Q27 38 30 48" fill="none" stroke="hsl(0, 72%, 50%)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M32 2 Q29 18 35 32 Q37 38 34 48" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            {/* Red bead */}
            <circle cx="24" cy="58" r="9" fill="hsl(0, 72%, 50%)" />
            <circle cx="22" cy="55" r="3" fill="hsl(0, 72%, 65%)" opacity="0.5" />
            {/* White bead */}
            <circle cx="40" cy="58" r="9" fill="white" stroke="hsl(0, 0%, 85%)" strokeWidth="1" />
            <circle cx="38" cy="55" r="3" fill="hsl(0, 0%, 96%)" opacity="0.7" />
            {/* Bow */}
            <path d="M28 48 Q32 44 36 48" fill="none" stroke="hsl(0, 72%, 50%)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            🌸 O primăvară frumoasă!
          </p>
        </div>

        {/* Ghiocei */}
        <div className="flex-shrink-0 hidden sm:block">
          <svg viewBox="0 0 50 60" className="w-10 h-12" aria-hidden="true">
            {/* Stem 1 */}
            <path d="M20 55 Q22 35 24 20" fill="none" stroke="hsl(130, 50%, 45%)" strokeWidth="2" strokeLinecap="round" />
            <path d="M22 42 Q15 38 18 30" fill="none" stroke="hsl(130, 50%, 45%)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Flower 1 */}
            <path d="M24 20 Q30 12 34 16" fill="none" stroke="hsl(130, 45%, 50%)" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="37" cy="17" rx="5" ry="2.5" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(15, 37, 17)" />
            <ellipse cx="36" cy="14" rx="4.5" ry="2" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(-5, 36, 14)" />
            <ellipse cx="38" cy="20" rx="4.5" ry="2" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(35, 38, 20)" />
            <ellipse cx="40" cy="17" rx="2" ry="1.2" fill="hsl(130, 50%, 55%)" transform="rotate(15, 40, 17)" />
            {/* Stem 2 */}
            <path d="M30 55 Q28 38 26 25" fill="none" stroke="hsl(130, 50%, 40%)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <path d="M26 25 Q20 18 16 22" fill="none" stroke="hsl(130, 45%, 50%)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
            <ellipse cx="13" cy="23" rx="4" ry="2" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.4" transform="rotate(-20, 13, 23)" opacity="0.7" />
            <ellipse cx="14" cy="20.5" rx="3.5" ry="1.8" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.4" transform="rotate(5, 14, 20.5)" opacity="0.7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SpringDecoration;
