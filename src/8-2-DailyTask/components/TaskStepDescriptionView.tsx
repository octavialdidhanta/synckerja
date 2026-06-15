import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  looksLikeHtml,
  prepareTaskStepDescriptionHtmlForView,
} from '@/8-2-DailyTask/lib/taskStepDescription';
import { TextWithAutoLinks } from '@/8-2-DailyTask/components/TextWithAutoLinks';
import type { ImageLoupeState } from '@/8-2-DailyTask/components/TaskStepDescriptionImageLoupePanel';

type TaskStepDescriptionViewProps = {
  value: string | null | undefined;
  className?: string;
  enableImageLoupe?: boolean;
  onImageLoupeChange?: (state: ImageLoupeState | null) => void;
};

const articleClass =
  'text-sm text-gray-700 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-gray-200 [&_a]:text-primary [&_a]:underline [&_a]:break-all [&_a]:hover:text-primary/90';

const loupeArticleClass = `${articleClass} [&_img]:cursor-zoom-in`;

function readLoupeState(img: HTMLImageElement, clientX: number, clientY: number): ImageLoupeState {
  const rect = img.getBoundingClientRect();
  const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const offsetY = Math.min(Math.max(clientY - rect.top, 0), rect.height);

  return {
    src: img.currentSrc || img.src,
    alt: img.alt || '',
    offsetX,
    offsetY,
    displayWidth: rect.width,
    displayHeight: rect.height,
  };
}

export function TaskStepDescriptionView({
  value,
  className,
  enableImageLoupe = false,
  onImageLoupeChange,
}: TaskStepDescriptionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onLoupeChangeRef = useRef(onImageLoupeChange);
  const activeImageRef = useRef<HTMLImageElement | null>(null);
  onLoupeChangeRef.current = onImageLoupeChange;

  useEffect(() => {
    if (!enableImageLoupe || !onImageLoupeChange) return;

    const container = containerRef.current;
    if (!container) return;

    const showLoupe = (img: HTMLImageElement, clientX: number, clientY: number) => {
      activeImageRef.current = img;
      onLoupeChangeRef.current?.(readLoupeState(img, clientX, clientY));
    };

    const hideLoupe = () => {
      activeImageRef.current = null;
      onLoupeChangeRef.current?.(null);
    };

    const handleEnter = (event: Event) => {
      const img = event.currentTarget as HTMLImageElement;
      const mouse = event as MouseEvent;
      showLoupe(img, mouse.clientX, mouse.clientY);
    };

    const handleMove = (event: Event) => {
      const img = event.currentTarget as HTMLImageElement;
      const mouse = event as MouseEvent;
      showLoupe(img, mouse.clientX, mouse.clientY);
    };

    const handleLeave = (event: Event) => {
      const mouse = event as MouseEvent;
      const next = mouse.relatedTarget;
      if (next instanceof Element) {
        const nextImg = next.closest('img');
        if (nextImg && container.contains(nextImg)) return;
      }
      if (activeImageRef.current === event.currentTarget) {
        hideLoupe();
      }
    };

    const handleContainerLeave = () => {
      hideLoupe();
    };

    const images = Array.from(container.querySelectorAll('img'));
    for (const img of images) {
      img.addEventListener('mouseenter', handleEnter);
      img.addEventListener('mousemove', handleMove);
      img.addEventListener('mouseleave', handleLeave);
    }
    container.addEventListener('mouseleave', handleContainerLeave);

    return () => {
      for (const img of images) {
        img.removeEventListener('mouseenter', handleEnter);
        img.removeEventListener('mousemove', handleMove);
        img.removeEventListener('mouseleave', handleLeave);
      }
      container.removeEventListener('mouseleave', handleContainerLeave);
      hideLoupe();
    };
  }, [enableImageLoupe, onImageLoupeChange, value]);

  if (!value?.trim()) return null;

  if (looksLikeHtml(value)) {
    const html = prepareTaskStepDescriptionHtmlForView(value);
    return (
      <div
        ref={containerRef}
        className={cn(enableImageLoupe ? loupeArticleClass : articleClass, className)}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) {
            event.stopPropagation();
          }
        }}
      />
    );
  }

  return (
    <TextWithAutoLinks
      text={value}
      as="p"
      className={cn('whitespace-pre-wrap break-words text-sm text-gray-700', className)}
    />
  );
}
