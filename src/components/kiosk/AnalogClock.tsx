import { useEffect, useState } from 'react';

const AnalogClock = ({ size = 120 }: { size?: number }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;

  const secondDeg = s * 6;
  const minuteDeg = m * 6 + s * 0.1;
  const hourDeg = h * 30 + m * 0.5;

  const r = size / 2;
  const cx = r;
  const cy = r;

  const hourMarkers = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const outer = r - 4;
    const inner = r - (i % 3 === 0 ? 14 : 9);
    return (
      <line
        key={i}
        x1={cx + inner * Math.cos(angle)}
        y1={cy + inner * Math.sin(angle)}
        x2={cx + outer * Math.cos(angle)}
        y2={cy + outer * Math.sin(angle)}
        stroke={i % 3 === 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
        strokeWidth={i % 3 === 0 ? 2.5 : 1.2}
        strokeLinecap="round"
      />
    );
  });

  const handStyle = (deg: number) => ({
    transform: `rotate(${deg}deg)`,
    transformOrigin: `${cx}px ${cy}px`,
    transition: 'transform 0.3s cubic-bezier(0.4, 2.08, 0.55, 0.44)',
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-md">
      {/* Face */}
      <circle cx={cx} cy={cy} r={r - 1} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r - 6} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.3} />

      {/* Markers */}
      {hourMarkers}

      {/* Hour hand */}
      <line
        x1={cx} y1={cy} x2={cx} y2={cy - r * 0.45}
        stroke="hsl(var(--foreground))"
        strokeWidth={3.5}
        strokeLinecap="round"
        style={handStyle(hourDeg)}
      />

      {/* Minute hand */}
      <line
        x1={cx} y1={cy} x2={cx} y2={cy - r * 0.65}
        stroke="hsl(var(--foreground))"
        strokeWidth={2.5}
        strokeLinecap="round"
        style={handStyle(minuteDeg)}
      />

      {/* Second hand */}
      <line
        x1={cx} y1={cy + r * 0.12}
        x2={cx} y2={cy - r * 0.7}
        stroke="hsl(var(--primary))"
        strokeWidth={1.2}
        strokeLinecap="round"
        style={handStyle(secondDeg)}
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3.5} fill="hsl(var(--primary))" />
      <circle cx={cx} cy={cy} r={1.5} fill="hsl(var(--background))" />
    </svg>
  );
};

export default AnalogClock;
