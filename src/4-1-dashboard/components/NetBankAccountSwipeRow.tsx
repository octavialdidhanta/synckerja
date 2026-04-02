import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

const REVEAL_DEFAULT = 96;
const SNAP_RATIO = 0.45;
/** Min movement before we decide swipe vs scroll */
const AXIS_LOCK_PX = 12;
/** Vertical wins only if clearly dominant (avoid killing horizontal swipe in a scroll area) */
const VERTICAL_VS_HORIZONTAL_RATIO = 2.2;
/** Ease-in-out: slow start and end so snap after release feels smooth (not mechanical). */
const SNAP_EASING = 'cubic-bezier(0.45, 0, 0.55, 1)';
const SNAP_DURATION_MS = 460;

export interface NetBankAccountSwipeRowProps {
  /** Stable id for parent state (open row). */
  rowId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: () => void;
  transferLabel: string;
  /** When true, the Transfer button is disabled (e.g. zero balance); swipe still works so the action stays discoverable. */
  disabled?: boolean;
  revealWidth?: number;
  className?: string;
  children: ReactNode;
}

export function NetBankAccountSwipeRow({
  rowId,
  isOpen,
  onOpenChange,
  onTransfer,
  transferLabel,
  disabled = false,
  revealWidth = REVEAL_DEFAULT,
  className,
  children,
}: NetBankAccountSwipeRowProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const baseOffsetRef = useRef(0);
  const lastOffsetRef = useRef(0);
  const horizontalLockRef = useRef(false);
  const verticalLockRef = useRef(false);

  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [panLock, setPanLock] = useState(false);

  const committedOffset = isOpen ? -revealWidth : 0;
  const visualOffset = dragging ? dragOffset : committedOffset;
  lastOffsetRef.current = visualOffset;

  useEffect(() => {
    if (!dragging) {
      setDragOffset(committedOffset);
    }
  }, [committedOffset, dragging]);

  const snapFrom = useCallback(
    (current: number) => {
      const threshold = -revealWidth * SNAP_RATIO;
      const shouldOpen = current <= threshold;
      onOpenChange(shouldOpen);
      setDragging(false);
      pointerIdRef.current = null;
      horizontalLockRef.current = false;
      verticalLockRef.current = false;
      setPanLock(false);
    },
    [onOpenChange, revealWidth]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    baseOffsetRef.current = visualOffset;
    horizontalLockRef.current = false;
    verticalLockRef.current = false;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (!horizontalLockRef.current && !verticalLockRef.current) {
      if (Math.abs(dx) >= AXIS_LOCK_PX || Math.abs(dy) >= AXIS_LOCK_PX) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        // Prefer horizontal swipe unless movement is clearly vertical (nested scroll list).
        if (absDy > absDx * VERTICAL_VS_HORIZONTAL_RATIO && absDy >= AXIS_LOCK_PX) {
          verticalLockRef.current = true;
          setDragging(false);
          pointerIdRef.current = null;
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          return;
        }
        if (absDx >= AXIS_LOCK_PX || absDx >= absDy) {
          horizontalLockRef.current = true;
          setPanLock(true);
        } else {
          return;
        }
      } else {
        return;
      }
    }

    if (!horizontalLockRef.current) return;

    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    const next = Math.min(0, Math.max(-revealWidth, baseOffsetRef.current + dx));
    lastOffsetRef.current = next;
    setDragOffset(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (verticalLockRef.current) {
      pointerIdRef.current = null;
      verticalLockRef.current = false;
      horizontalLockRef.current = false;
      setPanLock(false);
      return;
    }
    if (horizontalLockRef.current) {
      snapFrom(lastOffsetRef.current);
    } else {
      setDragging(false);
      pointerIdRef.current = null;
      setPanLock(false);
    }
    horizontalLockRef.current = false;
    verticalLockRef.current = false;
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    onPointerUp(e);
  };

  return (
    <div
      ref={wrapRef}
      data-row-id={rowId}
      className={cn('relative overflow-hidden rounded-lg touch-pan-y', className)}
    >
      <div
        className="absolute inset-0 z-0 flex justify-end bg-slate-200 dark:bg-slate-800"
        aria-hidden
      >
        <button
          type="button"
          disabled={disabled}
          onClick={(ev) => {
            ev.stopPropagation();
            onTransfer();
          }}
          className={cn(
            'flex h-full min-w-[5.5rem] items-center justify-center px-3 text-sm font-semibold text-white transition-colors duration-200 ease-in-out',
            'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {transferLabel}
        </button>
      </div>

      <div
        aria-expanded={isOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={cn(
          'relative z-[1] w-full cursor-grab active:cursor-grabbing rounded-lg bg-gray-200 shadow-none select-none',
          disabled && 'opacity-95'
        )}
        style={{
          transform: `translate3d(${visualOffset}px, 0, 0)`,
          transition: dragging
            ? 'none'
            : `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`,
          backfaceVisibility: 'hidden' as const,
          WebkitBackfaceVisibility: 'hidden',
          // Let vertical scroll work until we commit to horizontal drag; then take over for smooth swipe.
          touchAction: panLock ? 'none' : 'pan-y pinch-zoom',
        }}
      >
        {children}
      </div>
    </div>
  );
}
