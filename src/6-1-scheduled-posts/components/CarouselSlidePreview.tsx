import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';

const SWIPE_THRESHOLD_PX = 48;

type Props = {
  urls: string[];
  emptyLabel: string;
  className?: string;
  /** Fit the slide inside the parent box instead of sizing from the viewport. */
  contained?: boolean;
};

export function CarouselSlidePreview({ urls, emptyLabel, className, contained = false }: Props) {
  const { t } = useTranslation();
  const [slide, setSlide] = useState(0);
  const dragRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const listKey = urls.join('\n');

  useEffect(() => {
    setSlide(0);
  }, [listKey]);

  const count = urls.length;
  const index = count === 0 ? 0 : Math.min(slide, count - 1);
  const canGoBack = index > 0;
  const canGoForward = index < count - 1;

  const go = (delta: number) => {
    setSlide((current) => {
      const bounded = Math.min(Math.max(current, 0), Math.max(count - 1, 0));
      return Math.min(count - 1, Math.max(0, bounded + delta));
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start || start.pointerId !== event.pointerId || count < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  if (count === 0) {
    return (
      <div
        className={cn(
          contained
            ? 'flex h-full min-h-0 w-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground'
            : 'flex min-h-[42dvh] w-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground md:min-h-0 md:flex-1',
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        contained
          ? 'flex h-full min-h-0 w-full flex-col gap-1.5 overflow-hidden'
          : 'flex min-h-0 w-full flex-1 flex-col gap-2',
        className,
      )}
    >
      <div
        className={
          contained
            ? 'relative min-h-0 w-full flex-1 overflow-hidden'
            : 'relative flex min-h-[42dvh] w-full min-w-0 flex-1 items-center justify-center md:min-h-0'
        }
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        role="region"
        aria-roledescription="carousel"
        aria-label={t('digitalMarketing.scheduledPosts.carouselPreview', 'Carousel preview')}
      >
        <img
          src={urls[index]}
          alt={t('digitalMarketing.scheduledPosts.carouselSlide', {
            current: index + 1,
            total: count,
            defaultValue: `Carousel slide ${index + 1} of ${count}`,
          })}
          className={
            contained
              ? 'absolute inset-0 m-auto h-full w-full object-contain select-none'
              : 'h-auto w-auto max-h-[min(70dvh,calc(100dvh-12.5rem))] max-w-full object-contain select-none'
          }
          draggable={false}
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-foreground shadow-sm disabled:opacity-30"
              disabled={!canGoBack}
              aria-label={t('digitalMarketing.scheduledPosts.carouselPrevious', 'Previous slide')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => go(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-foreground shadow-sm disabled:opacity-30"
              disabled={!canGoForward}
              aria-label={t('digitalMarketing.scheduledPosts.carouselNext', 'Next slide')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => go(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          {index + 1} / {count}
        </span>
        {count > 1 ? (
          <div className="flex items-center gap-1" role="tablist" aria-label={t('digitalMarketing.scheduledPosts.carouselPreview', 'Carousel preview')}>
            {urls.map((url, dotIndex) => (
              <button
                key={url}
                type="button"
                role="tab"
                aria-selected={dotIndex === index}
                aria-label={t('digitalMarketing.scheduledPosts.carouselSlide', {
                  current: dotIndex + 1,
                  total: count,
                  defaultValue: `Carousel slide ${dotIndex + 1} of ${count}`,
                })}
                className={cn(
                  'h-1.5 rounded-full',
                  dotIndex === index ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/40',
                )}
                onClick={() => setSlide(dotIndex)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
