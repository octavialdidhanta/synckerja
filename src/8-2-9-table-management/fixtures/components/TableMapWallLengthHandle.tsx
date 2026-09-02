import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { FixtureLengthEdge } from "../lib/fixtureLayout";

type Props = {
  edge: FixtureLengthEdge;
  vertical: boolean;
  pinEnd: boolean;
  onPointerDown: (e: React.PointerEvent, edge: FixtureLengthEdge) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
};

/** Drag handle on a wall end; snaps length to the grid. */
export function TableMapWallLengthHandle({
  edge,
  vertical,
  pinEnd,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const { t } = useAppTranslation();
  const alongStart = edge === "start";

  const positionClass = vertical
    ? cn(
        pinEnd ? "right-0" : "left-0",
        alongStart ? "-top-1.5" : "-bottom-1.5",
      )
    : cn(
        pinEnd ? "bottom-0" : "top-0",
        alongStart ? "-left-1.5" : "-right-1.5",
      );

  return (
    <button
      type="button"
      className={cn(
        "absolute z-30 h-3.5 w-3.5 rounded-none border border-slate-500 bg-white shadow-md",
        vertical ? "cursor-ns-resize" : "cursor-ew-resize",
        positionClass,
      )}
      aria-label={t(
        "tableManagement.fixture.lengthenWall",
        "Drag to lengthen wall",
      )}
      title={t("tableManagement.fixture.lengthenWall", "Drag to lengthen wall")}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPointerDown(e, edge);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    />
  );
}
