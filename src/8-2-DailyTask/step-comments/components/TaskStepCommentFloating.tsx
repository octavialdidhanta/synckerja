import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const PANEL_GAP = 12;
const COMMENT_PANEL_WIDTH = 352;

export type CommentPanelPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/** Dock discussion panel to the right edge of the description popover — same top & height. */
export function computeCommentPanelPosition(anchor: HTMLElement): CommentPanelPosition {
  const rect = anchor.getBoundingClientRect();
  const panelWidth = Math.min(COMMENT_PANEL_WIDTH, window.innerWidth * 0.42);
  const viewportPadding = 16;

  let left = rect.right + PANEL_GAP;
  if (left + panelWidth > window.innerWidth - viewportPadding) {
    left = rect.left - PANEL_GAP - panelWidth;
  }
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - viewportPadding - panelWidth));

  return {
    top: rect.top,
    left,
    width: panelWidth,
    height: rect.height,
  };
}

type TaskStepCommentFloatingProps = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function TaskStepCommentFloating({
  anchorRef,
  open,
  title,
  onClose,
  children,
}: TaskStepCommentFloatingProps) {
  const [position, setPosition] = useState<CommentPanelPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      setPosition(computeCommentPanelPosition(el));
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(anchor);

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, open]);

  if (typeof document === 'undefined' || !open) return null;

  const resolvedPosition =
    position ?? (anchorRef.current ? computeCommentPanelPosition(anchorRef.current) : null);

  if (!resolvedPosition) return null;

  return createPortal(
    <div
      className="fixed z-[51] flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
      style={{
        top: resolvedPosition.top,
        left: resolvedPosition.left,
        width: resolvedPosition.width,
        height: resolvedPosition.height,
        maxWidth: `min(${COMMENT_PANEL_WIDTH}px, 42vw)`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h5 className="min-w-0 truncate text-xs font-semibold text-gray-900">{title}</h5>
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close discussion"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export const COMMENT_FLOAT_GAP = PANEL_GAP;
export const COMMENT_FLOAT_WIDTH = COMMENT_PANEL_WIDTH;
