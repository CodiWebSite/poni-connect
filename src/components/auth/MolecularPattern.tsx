/**
 * MolecularPattern
 * Decorative inline SVG inspired by polymer / macromolecular networks (ICMPP identity).
 * Discrete, performance-friendly (no external assets, no animation by default),
 * uses currentColor so it inherits the design-system foreground tint.
 */
const MolecularPattern = ({ className = '' }: { className?: string }) => {
  // Hand-tuned node coordinates on a 600x600 canvas — looks organic, not grid-snapped.
  const nodes: Array<{ x: number; y: number; r: number }> = [
    { x: 80, y: 110, r: 4 },
    { x: 210, y: 70, r: 3 },
    { x: 320, y: 150, r: 5 },
    { x: 450, y: 90, r: 3 },
    { x: 540, y: 200, r: 4 },
    { x: 150, y: 240, r: 3 },
    { x: 270, y: 300, r: 5 },
    { x: 400, y: 270, r: 3 },
    { x: 510, y: 360, r: 4 },
    { x: 90, y: 380, r: 3 },
    { x: 200, y: 450, r: 4 },
    { x: 330, y: 480, r: 5 },
    { x: 450, y: 440, r: 3 },
    { x: 560, y: 520, r: 3 },
    { x: 120, y: 540, r: 4 },
    { x: 380, y: 60, r: 3 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4], [2, 6], [1, 5],
    [5, 6], [6, 7], [3, 7], [7, 8], [4, 8],
    [5, 9], [9, 10], [10, 11], [6, 11], [11, 12],
    [7, 12], [12, 13], [8, 13], [10, 14], [14, 11],
    [3, 15], [15, 1],
  ];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 600"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ color: 'currentColor' }}
    >
      <defs>
        <radialGradient id="mp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#mp-glow)" />
      <g stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.6">
        {edges.map(([a, b], i) => (
          <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />
        ))}
      </g>
      <g fill="currentColor">
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fillOpacity={0.45} />
        ))}
      </g>
      {/* Soft halo around denser nodes */}
      <g fill="currentColor" fillOpacity="0.08">
        {nodes.filter(n => n.r >= 5).map((n, i) => (
          <circle key={`h${i}`} cx={n.x} cy={n.y} r={n.r * 4} />
        ))}
      </g>
    </svg>
  );
};

export default MolecularPattern;
