import { useState, useEffect, useRef } from 'react';

export function useAnimatedCounter(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevTarget.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return count;
}
