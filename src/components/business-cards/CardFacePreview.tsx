import { useLayoutEffect, useRef, useState } from 'react';
import { CARD_PREVIEW_H, CARD_PREVIEW_W, CARD_W, CARD_H } from './CardVariants';

export function CardFacePreview({ faceRef, children }: {
  faceRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setScale(viewport.clientWidth / CARD_PREVIEW_W);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={viewportRef} className="w-full min-w-0 overflow-hidden border rounded-md shadow-lg"
      style={{ aspectRatio: `${CARD_W}/${CARD_H}` }}>
      <div ref={faceRef} style={{ width: CARD_PREVIEW_W, height: CARD_PREVIEW_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}