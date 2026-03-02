import { useEffect, useState } from 'react';

const SpringDecoration = () => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const now = new Date();
    // Show only in March
    if (now.getMonth() === 2) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 pointer-events-none select-none animate-fade-in">
      <div className="relative w-28 h-32">
        {/* Mărțișor string */}
        <svg viewBox="0 0 120 140" className="w-full h-full drop-shadow-lg" aria-label="Mărțișor decorativ de 1 Martie">
          {/* Twisted red-white cord */}
          <path
            d="M60 5 Q65 30 55 55 Q50 70 58 90 Q62 100 56 115"
            fill="none"
            stroke="hsl(0, 75%, 50%)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M60 5 Q55 30 65 55 Q70 70 62 90 Q58 100 64 115"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Red circle */}
          <circle cx="48" cy="118" r="10" fill="hsl(0, 75%, 50%)" stroke="hsl(0, 60%, 40%)" strokeWidth="1.5" />
          <circle cx="48" cy="115" r="3" fill="hsl(0, 70%, 65%)" opacity="0.6" />
          
          {/* White circle */}
          <circle cx="72" cy="118" r="10" fill="white" stroke="hsl(0, 0%, 80%)" strokeWidth="1.5" />
          <circle cx="72" cy="115" r="3" fill="hsl(0, 0%, 95%)" opacity="0.8" />

          {/* Ghiocel (snowdrop flower) */}
          <g transform="translate(20, 0)">
            {/* Stem */}
            <path d="M18 45 Q20 30 22 15" fill="none" stroke="hsl(130, 50%, 40%)" strokeWidth="2" strokeLinecap="round" />
            {/* Leaf */}
            <path d="M18 40 Q10 35 14 28" fill="none" stroke="hsl(130, 50%, 40%)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Drooping stem */}
            <path d="M22 15 Q28 8 32 12" fill="none" stroke="hsl(130, 45%, 45%)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Petals */}
            <ellipse cx="35" cy="14" rx="5" ry="3" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(20, 35, 14)" />
            <ellipse cx="34" cy="11" rx="4.5" ry="2.5" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(-10, 34, 11)" />
            <ellipse cx="36" cy="17" rx="4.5" ry="2.5" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(40, 36, 17)" />
            {/* Green tip */}
            <ellipse cx="38" cy="14" rx="2" ry="1.5" fill="hsl(130, 50%, 55%)" transform="rotate(20, 38, 14)" />
          </g>

          {/* Second ghiocel */}
          <g transform="translate(62, -5) scale(0.85)">
            <path d="M18 45 Q16 30 15 18" fill="none" stroke="hsl(130, 50%, 40%)" strokeWidth="2" strokeLinecap="round" />
            <path d="M17 38 Q24 33 20 27" fill="none" stroke="hsl(130, 50%, 40%)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M15 18 Q10 10 6 14" fill="none" stroke="hsl(130, 45%, 45%)" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="3" cy="16" rx="5" ry="3" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(-20, 3, 16)" />
            <ellipse cx="4" cy="13" rx="4.5" ry="2.5" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(10, 4, 13)" />
            <ellipse cx="2" cy="19" rx="4.5" ry="2.5" fill="white" stroke="hsl(130, 20%, 85%)" strokeWidth="0.5" transform="rotate(-40, 2, 19)" />
            <ellipse cx="0" cy="16" rx="2" ry="1.5" fill="hsl(130, 50%, 55%)" transform="rotate(-20, 0, 16)" />
          </g>
        </svg>

        {/* Label */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-medium text-muted-foreground/70 italic">1 Martie</span>
        </div>
      </div>
    </div>
  );
};

export default SpringDecoration;
