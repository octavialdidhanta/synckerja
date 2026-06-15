import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';

export type ImageLoupeState = {
  src: string;
  alt: string;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
};

const LOUPE_ZOOM = 3;
export const LOUPE_PANEL_WIDTH = 896;
export const LOUPE_PANEL_HEIGHT = 720;

type TaskStepDescriptionImageLoupePanelProps = {
  state: ImageLoupeState;
  className?: string;
};

export function TaskStepDescriptionImageLoupePanel({
  state,
  className,
}: TaskStepDescriptionImageLoupePanelProps) {
  const { src, alt, offsetX, offsetY, displayWidth, displayHeight } = state;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({
    width: LOUPE_PANEL_WIDTH,
    height: LOUPE_PANEL_HEIGHT,
  });

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewportRef}
      className={cn(
        'relative h-[min(720px,78vh)] w-full min-w-[24rem] shrink-0 overflow-hidden',
        className,
      )}
      aria-hidden
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: displayWidth * LOUPE_ZOOM,
          height: displayHeight * LOUPE_ZOOM,
          left: viewport.width / 2 - offsetX * LOUPE_ZOOM,
          top: viewport.height / 2 - offsetY * LOUPE_ZOOM,
        }}
      />
    </div>
  );
}
