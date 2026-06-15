import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  TaskStepDescriptionImageLoupePanel,
  type ImageLoupeState,
} from '@/8-2-DailyTask/components/TaskStepDescriptionImageLoupePanel';

const LOUPE_GAP = 12;
const LOUPE_RIGHT_INSET = 40;

function computeLoupePosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const left = rect.right + LOUPE_GAP;
  const top = rect.top;
  const available = window.innerWidth - left - LOUPE_RIGHT_INSET;
  const width = Math.max(400, available * 0.96);

  return { top, left, width };
}

type TaskStepDescriptionImageLoupeFloatingProps = {
  anchorRef: RefObject<HTMLElement | null>;
  state: ImageLoupeState | null;
};

export function TaskStepDescriptionImageLoupeFloating({
  anchorRef,
  state,
}: TaskStepDescriptionImageLoupeFloatingProps) {
  const isActive = state != null;
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!isActive) {
      setPosition(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setPosition(computeLoupePosition(anchor));
    };

    update();
    const anchor = anchorRef.current;
    let resizeObserver: ResizeObserver | undefined;
    if (anchor) {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(anchor);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, isActive]);

  if (typeof document === 'undefined' || !state) return null;

  const resolvedPosition =
    position ??
    (anchorRef.current ? computeLoupePosition(anchorRef.current) : null);

  if (!resolvedPosition) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[51]"
      style={{
        top: resolvedPosition.top,
        left: resolvedPosition.left,
        width: resolvedPosition.width,
      }}
      aria-hidden
    >
      <TaskStepDescriptionImageLoupePanel state={state} className="w-full" />
    </div>,
    document.body,
  );
}
