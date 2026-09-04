import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import type { PosSettingsPhonePane } from "../../lib/posSettingsPhoneLayout";

const SWIPE_THRESHOLD_PX = 56;

type Props = {
  pane: PosSettingsPhonePane;
  onPaneChange: (pane: PosSettingsPhonePane) => void;
  list: ReactNode;
  detail: ReactNode;
  className?: string;
};

/**
 * Two-pane phone slider — absolute panes (no w-[200%]) so the page cannot grow wider than the viewport.
 */
export function PosSettingsPhonePaneSlider({
  pane,
  onPaneChange,
  list,
  detail,
  className,
}: Props) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    tracking.current = true;
  }, []);

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!tracking.current || startX.current == null || startY.current == null) {
        tracking.current = false;
        return;
      }
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      tracking.current = false;
      startX.current = null;
      startY.current = null;

      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

      if (dx < 0 && pane === "list") onPaneChange("detail");
      else if (dx > 0 && pane === "detail") onPaneChange("list");
    },
    [onPaneChange, pane],
  );

  const onPointerCancel = useCallback(() => {
    tracking.current = false;
    startX.current = null;
    startY.current = null;
  }, []);

  return (
    <div
      className={cn(
        "relative min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className={cn(
          "absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden [touch-action:pan-y]",
          "transition-transform duration-200 ease-out will-change-transform",
          pane === "list" ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
        aria-hidden={pane !== "list"}
      >
        {list}
      </div>
      <div
        className={cn(
          "absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden [touch-action:pan-y]",
          "transition-transform duration-200 ease-out will-change-transform",
          pane === "detail" ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
        aria-hidden={pane !== "detail"}
      >
        {detail}
      </div>
    </div>
  );
}
